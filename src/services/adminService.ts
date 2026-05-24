import {
	DEFAULT_SEAT_PRICE_MULTIPLIER,
	DEFAULT_TICKET_PRICE,
	VIP_PRICE_MULTIPLIER,
} from '../utils/constants.ts';
import {
	generateBrokenSeatIds,
	getDisabilitySeatPositions,
	getVipSeatPositions,
	validateDisabilityLayout,
} from '../utils/seatLayout.ts';
import type {
	AdminBooking,
	BookingSeat,
	Movie,
	Profile,
	SeatType,
	Screen,
	ShowtimeWithDetails,
} from '../utils/types.ts';
import supabase from './supabase.ts';

function positionKey(rowNumber: number, seatNumber: number) {
	return `${rowNumber}:${seatNumber}`;
}

// Builds the seats payload with VIP and disability seat types for a screen layout.
function buildSeatsPayload(
	screenId: number,
	totalRows: number,
	seatsPerRow: number,
) {
	const vipKeys = new Set(
		getVipSeatPositions(totalRows, seatsPerRow).map((position) =>
			positionKey(position.row_number, position.seat_number),
		),
	);
	const disabilityKeys = new Set(
		getDisabilitySeatPositions(totalRows, seatsPerRow).map((position) =>
			positionKey(position.row_number, position.seat_number),
		),
	);

	const seats: Array<{
		screen_id: number;
		row_number: number;
		seat_number: number;
		seat_type: SeatType;
		price_multiplier: number;
	}> = [];

	for (let rowNumber = 1; rowNumber <= totalRows; rowNumber += 1) {
		for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber += 1) {
			const key = positionKey(rowNumber, seatNumber);
			let seatType: SeatType = 'regular';
			let priceMultiplier = DEFAULT_SEAT_PRICE_MULTIPLIER;

			if (disabilityKeys.has(key)) {
				seatType = 'disability';
			} else if (vipKeys.has(key)) {
				seatType = 'vip';
				priceMultiplier = VIP_PRICE_MULTIPLIER;
			}

			seats.push({
				screen_id: screenId,
				row_number: rowNumber,
				seat_number: seatNumber,
				seat_type: seatType,
				price_multiplier: priceMultiplier,
			});
		}
	}

	return seats;
}

// Validates the screen layout
function validateScreenLayout(
	input: Pick<Screen, 'name' | 'total_rows' | 'seats_per_row'>,
) {
	if (!input.name.trim()) {
		throw new Error('Screen name is required.');
	}

	if (input.total_rows < 1 || input.seats_per_row < 1) {
		throw new Error(
			'Screen layout must have at least 1 row and 1 seat per row.',
		);
	}

	validateDisabilityLayout(input.total_rows, input.seats_per_row);
}

// Converts a value to a single record
function toSingleRecord(value: unknown) {
	if (Array.isArray(value)) {
		return (value[0] ?? null) as Record<string, unknown> | null;
	}

	return (value ?? null) as Record<string, unknown> | null;
}

// Normalizes the movie data
function normalizeMovie(record: Record<string, unknown>): Movie {
	return {
		id: Number(record.id),
		title: String(record.title ?? ''),
		duration: Number(record.duration ?? 0),
		description: record.description ? String(record.description) : null,
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

// Normalizes the screen data
function normalizeScreen(record: Record<string, unknown>): Screen {
	return {
		id: Number(record.id),
		name: String(record.name ?? ''),
		total_rows: Number(record.total_rows ?? 0),
		seats_per_row: Number(record.seats_per_row ?? 0),
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

// Normalizes the profile data
function normalizeProfile(record: Record<string, unknown>): Profile {
	return {
		id: String(record.id),
		email: String(record.email ?? ''),
		full_name: record.full_name ? String(record.full_name) : null,
		role: record.role === 'admin' ? 'admin' : 'user',
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

// Normalizes the showtime data
function normalizeShowtime(
	record: Record<string, unknown>,
): ShowtimeWithDetails {
	const movieRecord = toSingleRecord(record.movies);
	const screenRecord = toSingleRecord(record.screens);

	return {
		id: Number(record.id),
		movie_id: Number(record.movie_id),
		screen_id: Number(record.screen_id),
		start_time: String(record.start_time),
		base_price: Number(record.base_price ?? DEFAULT_TICKET_PRICE),
		created_at: String(record.created_at ?? new Date().toISOString()),
		movie: movieRecord ? normalizeMovie(movieRecord) : null,
		screen: screenRecord ? normalizeScreen(screenRecord) : null,
	};
}

// Fetches the movies
export async function fetchMovies() {
	const { data, error } = await supabase
		.from('movies')
		.select('id, title, duration, description, created_at')
		.order('created_at', { ascending: false });

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) =>
		normalizeMovie(record as Record<string, unknown>),
	);
}

// Creates a movie
export async function createMovie(
	input: Pick<Movie, 'title' | 'duration' | 'description'>,
) {
	const { error } = await supabase.from('movies').insert(input);

	if (error) {
		throw error;
	}
}

// Updates a movie
export async function updateMovie(
	movieId: number,
	input: Pick<Movie, 'title' | 'duration' | 'description'>,
) {
	const { error } = await supabase
		.from('movies')
		.update(input)
		.eq('id', movieId);

	if (error) {
		throw error;
	}
}

// Deletes a movie
export async function deleteMovie(movieId: number) {
	const { error } = await supabase.from('movies').delete().eq('id', movieId);

	if (error) {
		throw error;
	}
}

// Fetches the screens
export async function fetchScreens() {
	const { data, error } = await supabase
		.from('screens')
		.select('id, name, total_rows, seats_per_row, created_at')
		.order('created_at', { ascending: false });

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) =>
		normalizeScreen(record as Record<string, unknown>),
	);
}

// Creates a screen and generates its static seat layout from total rows and seats per row.
export async function createScreen(
	input: Pick<Screen, 'name' | 'total_rows' | 'seats_per_row'>,
) {
	validateScreenLayout(input);

	const { data: screenData, error: screenError } = await supabase
		.from('screens')
		.insert(input)
		.select('id, name, total_rows, seats_per_row, created_at')
		.single();

	if (screenError) {
		throw screenError;
	}

	const screen = normalizeScreen(screenData as Record<string, unknown>);
	const seatsPayload = buildSeatsPayload(
		screen.id,
		screen.total_rows,
		screen.seats_per_row,
	);
	const { error: seatsError } = await supabase
		.from('seats')
		.insert(seatsPayload);

	if (seatsError) {
		await supabase.from('screens').delete().eq('id', screen.id);
		throw seatsError;
	}

	return screen;
}

// Updates screen metadata and regenerates seats only when the layout changes and the screen is unused.
export async function updateScreen(
	screenId: number,
	input: Pick<Screen, 'name' | 'total_rows' | 'seats_per_row'>,
) {
	validateScreenLayout(input);

	const { data: existingScreenData, error: existingScreenError } =
		await supabase
			.from('screens')
			.select('id, name, total_rows, seats_per_row, created_at')
			.eq('id', screenId)
			.single();

	if (existingScreenError) {
		throw existingScreenError;
	}

	const existingScreen = normalizeScreen(
		existingScreenData as Record<string, unknown>,
	);
	const layoutChanged =
		existingScreen.total_rows !== input.total_rows ||
		existingScreen.seats_per_row !== input.seats_per_row;

	if (layoutChanged) {
		const { data: dependentShowtimes, error: showtimeError } = await supabase
			.from('showtimes')
			.select('id')
			.eq('screen_id', screenId)
			.limit(1);

		if (showtimeError) {
			throw showtimeError;
		}

		if ((dependentShowtimes ?? []).length > 0) {
			throw new Error(
				'Cannot change screen rows or seats per row after showtimes have been scheduled for this screen.',
			);
		}
	}

	const { error: updateError } = await supabase
		.from('screens')
		.update(input)
		.eq('id', screenId);

	if (updateError) {
		throw updateError;
	}

	if (!layoutChanged) {
		return;
	}

	const { error: deleteSeatsError } = await supabase
		.from('seats')
		.delete()
		.eq('screen_id', screenId);

	if (deleteSeatsError) {
		throw deleteSeatsError;
	}

	const seatsPayload = buildSeatsPayload(
		screenId,
		input.total_rows,
		input.seats_per_row,
	);
	const { error: insertSeatsError } = await supabase
		.from('seats')
		.insert(seatsPayload);

	if (insertSeatsError) {
		throw insertSeatsError;
	}
}

export async function deleteScreen(screenId: number) {
	const { error } = await supabase.from('screens').delete().eq('id', screenId);

	if (error) {
		throw error;
	}
}

export async function fetchAdminShowtimes() {
	const { data, error } = await supabase
		.from('showtimes')
		.select(
			'id, movie_id, screen_id, start_time, base_price, created_at, movies(id, title, duration, description, created_at), screens(id, name, total_rows, seats_per_row, created_at)',
		)
		.order('start_time', { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) =>
		normalizeShowtime(record as Record<string, unknown>),
	);
}

export async function createShowtime(input: {
	movie_id: number;
	screen_id: number;
	start_time: string;
	base_price?: number;
}) {
	const { data: showtimeData, error: showtimeError } = await supabase
		.from('showtimes')
		.insert({
			...input,
			base_price: input.base_price ?? DEFAULT_TICKET_PRICE,
		})
		.select('id, screen_id')
		.single();

	if (showtimeError) {
		throw showtimeError;
	}

	const showtimeId = Number(showtimeData.id);
	const screenId = Number(showtimeData.screen_id);
	const { data: seatsData, error: seatsError } = await supabase
		.from('seats')
		.select('id, screen_id, row_number, seat_number, seat_type, price_multiplier')
		.eq('screen_id', screenId)
		.order('row_number', { ascending: true })
		.order('seat_number', { ascending: true });

	if (seatsError) {
		await supabase.from('showtimes').delete().eq('id', showtimeId);
		throw seatsError;
	}

	const brokenSeatIds = generateBrokenSeatIds(
		(seatsData ?? []).map((record) => ({
			id: Number(record.id),
			screen_id: Number(record.screen_id),
			row_number: Number(record.row_number),
			seat_number: Number(record.seat_number),
			seat_type: record.seat_type === 'vip' ? 'vip' : record.seat_type === 'disability' ? 'disability' : 'regular',
			price_multiplier: Number(record.price_multiplier ?? DEFAULT_SEAT_PRICE_MULTIPLIER),
		})),
	);

	if (brokenSeatIds.length > 0) {
		const { error: brokenSeatsError } = await supabase
			.from('showtime_broken_seats')
			.insert(
				brokenSeatIds.map((seatId) => ({
					showtime_id: showtimeId,
					seat_id: seatId,
				})),
			);

		if (brokenSeatsError) {
			await supabase.from('showtimes').delete().eq('id', showtimeId);
			throw brokenSeatsError;
		}
	}
}

export async function updateShowtime(
	showtimeId: number,
	input: {
		movie_id: number;
		screen_id: number;
		start_time: string;
		base_price?: number;
	},
) {
	const { error } = await supabase
		.from('showtimes')
		.update(input)
		.eq('id', showtimeId);

	if (error) {
		throw error;
	}
}

export async function deleteShowtime(showtimeId: number) {
	const { error } = await supabase
		.from('showtimes')
		.delete()
		.eq('id', showtimeId);

	if (error) {
		throw error;
	}
}

export async function fetchAdminBookings() {
	const { data: bookingsData, error: bookingsError } = await supabase
		.from('bookings')
		.select(
			'id, showtime_id, user_id, status, total_price, admin_override_used, created_at, booking_seats(id, booking_id, seat_id), showtimes(id, movie_id, screen_id, start_time, base_price, created_at, movies(id, title, duration, description, created_at), screens(id, name, total_rows, seats_per_row, created_at))',
		)
		.order('created_at', { ascending: false });

	if (bookingsError) {
		throw bookingsError;
	}

	const userIds = [
		...new Set(
			(bookingsData ?? []).map((booking) => booking.user_id).filter(Boolean),
		),
	];
	const profilesById = new Map<string, Profile>();

	if (userIds.length > 0) {
		const { data: profilesData, error: profilesError } = await supabase
			.from('profiles')
			.select('id, email, full_name, role, created_at')
			.in('id', userIds);

		if (profilesError) {
			throw profilesError;
		}

		for (const profile of profilesData ?? []) {
			const normalizedProfile = normalizeProfile(
				profile as Record<string, unknown>,
			);
			profilesById.set(normalizedProfile.id, normalizedProfile);
		}
	}

	return (bookingsData ?? []).map((record) => ({
		id: Number(record.id),
		showtime_id: Number(record.showtime_id),
		user_id: String(record.user_id),
		status: record.status === 'pending' ? 'pending' : 'confirmed',
		total_price: Number(record.total_price ?? 0),
		admin_override_used: Boolean(record.admin_override_used),
		created_at: String(record.created_at ?? new Date().toISOString()),
		booking_seats: ((record.booking_seats ?? []) as BookingSeat[]).map(
			(seat) => ({
				id: Number(seat.id),
				booking_id: Number(seat.booking_id),
				seat_id: Number(seat.seat_id),
			}),
		),
		profile: profilesById.get(String(record.user_id)) ?? null,
		showtime: record.showtimes
			? normalizeShowtime(toSingleRecord(record.showtimes) ?? {})
			: null,
	})) as AdminBooking[];
}
