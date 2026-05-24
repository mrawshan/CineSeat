// Defines the query keys for the application
export const queryKeys = {
	auth: {
		session: ['auth', 'session'] as const,
		profile: (userId: string) => ['auth', 'profile', userId] as const,
	},
	showtimes: {
		byDate: (date: string) => ['showtimes', 'date', date] as const,
		detail: (showtimeId: number) =>
			['showtimes', 'detail', showtimeId] as const,
		admin: ['admin', 'showtimes'] as const,
	},
	seats: {
		map: (showtimeId: number) => ['seats', 'map', showtimeId] as const,
	},
	bookings: {
		userSeatsByShowtime: (showtimeId: number, userId: string) =>
			['bookings', 'user-seats', showtimeId, userId] as const,
	},
	admin: {
		movies: ['admin', 'movies'] as const,
		screens: ['admin', 'screens'] as const,
		bookings: ['admin', 'bookings'] as const,
	},
};
