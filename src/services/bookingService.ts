import { DEFAULT_TICKET_PRICE, SEAT_LOCK_MINUTES } from '../utils/constants.ts';
import { calculateBookingTotal } from '../utils/pricing.ts';
import type { Booking, BookingSeat, Seat, SeatLock } from '../utils/types.ts';
import supabase from './supabase.ts';

function normalizeBooking(record: Record<string, unknown>): Booking {
	return {
		id: Number(record.id),
		showtime_id: Number(record.showtime_id),
		user_id: String(record.user_id),
		status: record.status === 'pending' ? 'pending' : 'confirmed',
		total_price: Number(record.total_price ?? 0),
		admin_override_used: Boolean(record.admin_override_used),
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

function normalizeSeatLock(record: Record<string, unknown>): SeatLock {
	return {
		id: Number(record.id),
		showtime_id: Number(record.showtime_id),
		seat_id: Number(record.seat_id),
		user_id: String(record.user_id),
		locked_until: String(record.locked_until),
	};
}

async function fetchBrokenSeatIds(showtimeId: number) {
	const { data, error } = await supabase
		.from('showtime_broken_seats')
		.select('seat_id')
		.eq('showtime_id', showtimeId);

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) => Number(record.seat_id));
}

async function fetchSeatsForShowtime(showtimeId: number) {
	const { data: showtimeData, error: showtimeError } = await supabase
		.from('showtimes')
		.select('screen_id, base_price')
		.eq('id', showtimeId)
		.single();

	if (showtimeError) {
		throw showtimeError;
	}

	const { data: seatsData, error: seatsError } = await supabase
		.from('seats')
		.select(
			'id, screen_id, row_number, seat_number, seat_type, price_multiplier',
		)
		.eq('screen_id', Number(showtimeData.screen_id));

	if (seatsError) {
		throw seatsError;
	}

	return {
		basePrice: Number(showtimeData.base_price ?? DEFAULT_TICKET_PRICE),
		seats: (seatsData ?? []).map(
			(record) =>
				({
					id: Number(record.id),
					screen_id: Number(record.screen_id),
					row_number: Number(record.row_number),
					seat_number: Number(record.seat_number),
					seat_type:
						record.seat_type === 'vip'
							? 'vip'
							: record.seat_type === 'disability'
								? 'disability'
								: 'regular',
					price_multiplier: Number(record.price_multiplier ?? 1),
				}) as Seat,
		),
	};
}

// Collects seat ids that are already confirmed, locked by others, or broken for normal users.
async function getUnavailableSeatIds(
	showtimeId: number,
	currentUserId: string,
	options?: { allowBrokenSeats?: boolean },
) {
	const [confirmedResult, locksResult, brokenSeatIds] = await Promise.all([
		supabase
			.from('bookings')
			.select('booking_seats(seat_id)')
			.eq('showtime_id', showtimeId)
			.eq('status', 'confirmed'),
		supabase
			.from('seat_locks')
			.select('seat_id, user_id')
			.eq('showtime_id', showtimeId)
			.gt('locked_until', new Date().toISOString()),
		options?.allowBrokenSeats
			? Promise.resolve([])
			: fetchBrokenSeatIds(showtimeId),
	]);

	if (confirmedResult.error) {
		throw confirmedResult.error;
	}

	if (locksResult.error) {
		throw locksResult.error;
	}

	const confirmedSeatIds = (confirmedResult.data ?? []).flatMap((booking) =>
		((booking.booking_seats ?? []) as Array<Record<string, unknown>>).map(
			(seat) => Number(seat.seat_id),
		),
	);

	const lockedSeatIds = (locksResult.data ?? [])
		.filter((seatLock) => seatLock.user_id !== currentUserId)
		.map((seatLock) => Number(seatLock.seat_id));

	return new Set([...confirmedSeatIds, ...lockedSeatIds, ...brokenSeatIds]);
}

export async function releaseSeatLocks(options: {
	showtimeId: number;
	userId: string;
	seatIds?: number[];
	expiredOnly?: boolean;
}) {
	let query = supabase
		.from('seat_locks')
		.delete()
		.eq('showtime_id', options.showtimeId)
		.eq('user_id', options.userId);

	if (options.seatIds && options.seatIds.length > 0) {
		query = query.in('seat_id', options.seatIds);
	}

	if (options.expiredOnly) {
		query = query.lte('locked_until', new Date().toISOString());
	}

	const { error } = await query;

	if (error) {
		throw error;
	}
}

// Replaces the current user's seat locks for a showtime so the UI always mirrors server state.
export async function syncSeatLocks(options: {
	showtimeId: number;
	userId: string;
	seatIds: number[];
	adminOverride?: boolean;
}) {
	await releaseSeatLocks({
		showtimeId: options.showtimeId,
		userId: options.userId,
	});

	if (options.seatIds.length === 0) {
		return [] as SeatLock[];
	}

	const unavailableSeatIds = await getUnavailableSeatIds(
		options.showtimeId,
		options.userId,
		{ allowBrokenSeats: options.adminOverride },
	);
	const hasConflict = options.seatIds.some((seatId) =>
		unavailableSeatIds.has(seatId),
	);

	if (hasConflict) {
		throw new Error('One or more selected seats are no longer available.');
	}

	const lockedUntil = new Date(
		Date.now() + SEAT_LOCK_MINUTES * 60_000,
	).toISOString();
	const payload = options.seatIds.map((seatId) => ({
		showtime_id: options.showtimeId,
		seat_id: seatId,
		user_id: options.userId,
		locked_until: lockedUntil,
	}));

	const { data, error } = await supabase
		.from('seat_locks')
		.insert(payload)
		.select('id, showtime_id, seat_id, user_id, locked_until');

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) =>
		normalizeSeatLock(record as Record<string, unknown>),
	);
}

// Confirms the booking after re-checking seat availability and cleaning up the temporary locks.
export async function confirmBooking(options: {
	showtimeId: number;
	userId: string;
	seatIds: number[];
	adminOverride?: boolean;
}) {
	if (options.seatIds.length === 0) {
		throw new Error(
			'Select at least one seat before confirming the booking.',
		);
	}

	const unavailableSeatIds = await getUnavailableSeatIds(
		options.showtimeId,
		options.userId,
		{ allowBrokenSeats: options.adminOverride },
	);
	const hasConflict = options.seatIds.some((seatId) =>
		unavailableSeatIds.has(seatId),
	);

	if (hasConflict) {
		throw new Error(
			'Your seat selection changed because another booking was completed.',
		);
	}

	const { basePrice, seats } = await fetchSeatsForShowtime(options.showtimeId);
	const totalPrice = calculateBookingTotal(options.seatIds, seats, basePrice);
	const { data: bookingData, error: bookingError } = await supabase
		.from('bookings')
		.insert({
			showtime_id: options.showtimeId,
			user_id: options.userId,
			status: 'confirmed',
			total_price: totalPrice,
			admin_override_used: Boolean(options.adminOverride),
		})
		.select(
			'id, showtime_id, user_id, status, total_price, admin_override_used, created_at',
		)
		.single();

	if (bookingError) {
		throw bookingError;
	}

	const booking = normalizeBooking(bookingData as Record<string, unknown>);
	const payload = options.seatIds.map((seatId) => ({
		booking_id: booking.id,
		seat_id: seatId,
	}));

	const { data: bookingSeatsData, error: bookingSeatsError } = await supabase
		.from('booking_seats')
		.insert(payload)
		.select('id, booking_id, seat_id');

	if (bookingSeatsError) {
		throw bookingSeatsError;
	}

	await releaseSeatLocks({
		showtimeId: options.showtimeId,
		userId: options.userId,
	});

	return {
		booking,
		bookingSeats: (bookingSeatsData ?? []) as BookingSeat[],
	};
}

// Returns every seat the user has confirmed across all bookings for one showtime.
export async function fetchUserBookedSeatsByShowtime(options: {
	showtimeId: number;
	userId: string;
}) {
	const { data, error } = await supabase
		.from('bookings')
		.select(
			`
      id,
      booking_seats(
        seat_id,
        seats (
          id,
          screen_id,
          row_number,
          seat_number,
          seat_type,
          price_multiplier
        )
      )
    `,
		)
		.eq('showtime_id', options.showtimeId)
		.eq('user_id', options.userId)
		.eq('status', 'confirmed')
		.order('created_at', { ascending: false });

	if (error) {
		throw error;
	}

	const seatsById = new Map<number, Seat>();

	for (const booking of data ?? []) {
		const bookingSeats = booking.booking_seats ?? [];

		for (const record of bookingSeats as Array<Record<string, unknown>>) {
			const seatValue = record.seats;
			const seatRecords = !seatValue
				? []
				: Array.isArray(seatValue)
					? seatValue
					: [seatValue];

			for (const seat of seatRecords) {
				const normalizedSeat = {
					id: Number(seat.id),
					screen_id: Number(seat.screen_id),
					row_number: Number(seat.row_number),
					seat_number: Number(seat.seat_number),
					seat_type:
						seat.seat_type === 'vip'
							? 'vip'
							: seat.seat_type === 'disability'
								? 'disability'
								: 'regular',
					price_multiplier: Number(seat.price_multiplier ?? 1),
				} as Seat;

				if (Number.isFinite(normalizedSeat.id)) {
					seatsById.set(normalizedSeat.id, normalizedSeat);
				}
			}
		}
	}

	return [...seatsById.values()].sort((left, right) => {
		if (left.row_number !== right.row_number) {
			return left.row_number - right.row_number;
		}

		return left.seat_number - right.seat_number;
	});
}
