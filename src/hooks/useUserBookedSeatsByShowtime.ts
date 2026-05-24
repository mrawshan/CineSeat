import { useQuery } from '@tanstack/react-query';
import { fetchUserBookedSeatsByShowtime } from '../services/bookingService.ts';
import { queryKeys } from '../services/queryKeys.ts';

// Hook for the user booked seats by showtime
// Provides the user booked seats by showtime query
// The query fetches the user booked seats by showtime
// It is enabled only if the showtime id and user id are not empty
export function useUserBookedSeatsByShowtime(
	showtimeId: number,
	userId?: string,
) {
	return useQuery({
		queryKey: userId
			? queryKeys.bookings.userSeatsByShowtime(showtimeId, userId)
			: ['bookings', 'user-seats', showtimeId, 'anonymous'],
		queryFn: () =>
			fetchUserBookedSeatsByShowtime({
				showtimeId,
				userId: userId ?? '',
			}),
		enabled: Number.isFinite(showtimeId) && showtimeId > 0 && Boolean(userId),
	});
}
