import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin';
export type BookingStatus = 'pending' | 'confirmed';
export type SeatType = 'regular' | 'vip' | 'disability';
export type SeatState =
	| 'available'
	| 'selected'
	| 'locked'
	| 'booked'
	| 'broken';

export interface Profile {
	id: string;
	email: string;
	full_name: string | null;
	role: UserRole;
	created_at: string;
}

export interface Movie {
	id: number;
	title: string;
	duration: number;
	description: string | null;
	created_at: string;
}

export interface Screen {
	id: number;
	name: string;
	total_rows: number;
	seats_per_row: number;
	created_at: string;
}

export interface Seat {
	id: number;
	screen_id: number;
	row_number: number;
	seat_number: number;
	seat_type: SeatType;
	price_multiplier: number;
}

export interface Showtime {
	id: number;
	movie_id: number;
	screen_id: number;
	start_time: string;
	base_price: number;
	created_at: string;
}

export interface ShowtimeWithDetails extends Showtime {
	movie: Movie | null;
	screen: Screen | null;
}

export interface Booking {
	id: number;
	showtime_id: number;
	user_id: string;
	status: BookingStatus;
	total_price: number;
	admin_override_used: boolean;
	created_at: string;
}

export interface BookingSeat {
	id: number;
	booking_id: number;
	seat_id: number;
}

export interface SeatLock {
	id: number;
	showtime_id: number;
	seat_id: number;
	user_id: string;
	locked_until: string;
}

export interface ShowtimeBrokenSeat {
	id: number;
	showtime_id: number;
	seat_id: number;
}

export interface SeatMapData {
	showtime: ShowtimeWithDetails;
	seats: Seat[];
	bookedSeatIds: number[];
	brokenSeatIds: number[];
	activeLocks: SeatLock[];
}

export interface AdminBooking extends Booking {
	booking_seats: BookingSeat[];
	profile: Profile | null;
	showtime: ShowtimeWithDetails | null;
}

export interface AuthContextValue {
	session: Session | null;
	user: User | null;
	profile: Profile | null;
	isAuthenticated: boolean;
	isAdmin: boolean;
	isLoading: boolean;
	signInWithGoogle: () => Promise<void>;
	signInWithPassword: (credentials: {
		email: string;
		password: string;
	}) => Promise<void>;
	signOut: () => Promise<void>;
}
