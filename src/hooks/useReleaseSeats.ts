import { useMutation, useQueryClient } from '@tanstack/react-query';
import { releaseSeatLocks } from '../services/bookingService.ts';
import { queryKeys } from '../services/queryKeys.ts';
import type { SeatMapData } from '../utils/types.ts';

// Hook for the release seats page
// Provides the release seats mutation
// The mutation releases the seats
// It invalidates the seats query
// when the mutation is successful
export function useReleaseSeats(showtimeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: releaseSeatLocks,
		onMutate: async (variables) => {
			await queryClient.cancelQueries({
				queryKey: queryKeys.seats.map(showtimeId),
			});

			const previous = queryClient.getQueryData<SeatMapData>(
				queryKeys.seats.map(showtimeId),
			);

			queryClient.setQueryData<SeatMapData>(
				queryKeys.seats.map(showtimeId),
				(current) => {
					if (!current) {
						return current;
					}

					const nowIso = new Date().toISOString();
					const nextLocks = current.activeLocks.filter((seatLock) => {
						if (seatLock.user_id !== variables.userId) {
							return true;
						}

						if (variables.seatIds && variables.seatIds.length > 0) {
							return !variables.seatIds.includes(seatLock.seat_id);
						}

						if (variables.expiredOnly) {
							return seatLock.locked_until > nowIso;
						}

						return false;
					});

					return {
						...current,
						activeLocks: nextLocks,
					};
				},
			);

			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					queryKeys.seats.map(showtimeId),
					context.previous,
				);
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.seats.map(showtimeId),
			});
		},
	});
}
