import { DEFAULT_SEAT_PRICE_MULTIPLIER, DEFAULT_TICKET_PRICE } from '../utils/constants.ts';
import { getDateRange } from '../utils/date.ts';
import type {
	Movie,
	Screen,
	Seat,
	SeatLock,
	SeatMapData,
	SeatType,
	ShowtimeWithDetails,
} from '../utils/types.ts';
import supabase from './supabase.ts';

function normalizeMovie(record: Record<string, unknown> | null): Movie | null {
	if (!record) {
		return null;
	}

	return {
		id: Number(record.id),
		title: String(record.title ?? ''),
		duration: Number(record.duration ?? 0),
		description: record.description ? String(record.description) : null,
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

function normalizeScreen(record: Record<string, unknown> | null): Screen | null {
	if (!record) {
		return null;
	}

	return {
		id: Number(record.id),
		name: String(record.name ?? ''),
		total_rows: Number(record.total_rows ?? 0),
		seats_per_row: Number(record.seats_per_row ?? 0),
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

function toSingleRecord(value: unknown) {
	if (Array.isArray(value)) {
		return (value[0] ?? null) as Record<string, unknown> | null;
	}

	return (value ?? null) as Record<string, unknown> | null;
}

function normalizeShowtime(record: Record<string, unknown>): ShowtimeWithDetails {
	return {
		id: Number(record.id),
		movie_id: Number(record.movie_id),
		screen_id: Number(record.screen_id),
		start_time: String(record.start_time),
		base_price: Number(record.base_price ?? DEFAULT_TICKET_PRICE),
		created_at: String(record.created_at ?? new Date().toISOString()),
		movie: normalizeMovie(toSingleRecord(record.movies)),
		screen: normalizeScreen(toSingleRecord(record.screens)),
	};
}

function normalizeSeatType(value: unknown): SeatType {
	if (value === 'vip' || value === 'disability') {
		return value;
	}

	return 'regular';
}

function normalizeSeat(record: Record<string, unknown>): Seat {
	return {
		id: Number(record.id),
		screen_id: Number(record.screen_id),
		row_number: Number(record.row_number),
		seat_number: Number(record.seat_number),
		seat_type: normalizeSeatType(record.seat_type),
		price_multiplier: Number(
			record.price_multiplier ?? DEFAULT_SEAT_PRICE_MULTIPLIER,
		),
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

async function fetchConfirmedBookedSeatIds(showtimeId: number) {
	const { data, error } = await supabase
		.from('bookings')
		.select('booking_seats(seat_id)')
		.eq('showtime_id', showtimeId)
		.eq('status', 'confirmed');

	if (error) {
		throw error;
	}

	return (data ?? []).flatMap((booking) =>
		((booking.booking_seats ?? []) as Array<Record<string, unknown>>).map((seat) => Number(seat.seat_id)),
	);
}

export async function fetchShowtimesByDate(dateValue: string) {
	const { start, end } = getDateRange(dateValue);
	const { data, error } = await supabase
		.from('showtimes')
		.select(
			'id, movie_id, screen_id, start_time, base_price, created_at, movies(id, title, duration, description, created_at), screens(id, name, total_rows, seats_per_row, created_at)',
		)
		.gte('start_time', start)
		.lte('start_time', end)
		.order('start_time', { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) => normalizeShowtime(record as Record<string, unknown>));
}

export async function fetchShowtimeById(showtimeId: number) {
	const { data, error } = await supabase
		.from('showtimes')
		.select(
			'id, movie_id, screen_id, start_time, base_price, created_at, movies(id, title, duration, description, created_at), screens(id, name, total_rows, seats_per_row, created_at)',
		)
		.eq('id', showtimeId)
		.single();

	if (error) {
		throw error;
	}

	return normalizeShowtime(data as Record<string, unknown>);
}

export async function fetchSeatsByScreenId(screenId: number) {
	const { data, error } = await supabase
		.from('seats')
		.select('id, screen_id, row_number, seat_number, seat_type, price_multiplier')
		.eq('screen_id', screenId)
		.order('row_number', { ascending: true })
		.order('seat_number', { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) => normalizeSeat(record as Record<string, unknown>));
}

export async function fetchActiveSeatLocks(showtimeId: number) {
	const { data, error } = await supabase
		.from('seat_locks')
		.select('id, showtime_id, seat_id, user_id, locked_until')
		.eq('showtime_id', showtimeId)
		.gt('locked_until', new Date().toISOString());

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) => normalizeSeatLock(record as Record<string, unknown>));
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

// Loads the seat map data required to render booking availability for one showtime.
export async function fetchSeatMap(showtimeId: number): Promise<SeatMapData> {
	const showtime = await fetchShowtimeById(showtimeId);
	const seats = showtime.screen ? await fetchSeatsByScreenId(showtime.screen.id) : [];
	const [bookedSeatIds, brokenSeatIds, activeLocks] = await Promise.all([
		fetchConfirmedBookedSeatIds(showtimeId),
		fetchBrokenSeatIds(showtimeId),
		fetchActiveSeatLocks(showtimeId),
	]);

	return {
		showtime,
		seats,
		bookedSeatIds,
		brokenSeatIds,
		activeLocks,
	};
}
