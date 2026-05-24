import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmBooking } from '../services/bookingService.ts';
import { queryKeys } from '../services/queryKeys.ts';

// Hook for the confirm booking page
// Provides the confirm booking mutation
// The mutation confirms the booking
// It invalidates the seats query, the showtimes query, the admin bookings query, and the user seats by showtime query
export function useConfirmBooking(showtimeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: confirmBooking,
		onSuccess: (result) => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.seats.map(showtimeId),
			});
			void queryClient.invalidateQueries({
				queryKey: ['showtimes', 'date'],
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.admin.bookings,
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.bookings.userSeatsByShowtime(
					showtimeId,
					result.booking.user_id,
				),
			});
		},
	});
}
