import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncSeatLocks } from '../services/bookingService.ts';
import { queryKeys } from '../services/queryKeys.ts';
import { SEAT_LOCK_MINUTES } from '../utils/constants.ts';
import type { SeatLock, SeatMapData } from '../utils/types.ts';

// Hook for the lock seats page
// Provides the lock seats mutation
// The mutation locks the seats
// It invalidates the seats query
export function useLockSeats(showtimeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: syncSeatLocks,
		onMutate: async (variables) => {
			await queryClient.cancelQueries({
				queryKey: queryKeys.seats.map(showtimeId),
			});

			const previous = queryClient.getQueryData<SeatMapData>(
				queryKeys.seats.map(showtimeId),
			);

			const lockedUntil = new Date(
				Date.now() + SEAT_LOCK_MINUTES * 60_000,
			).toISOString();

			queryClient.setQueryData<SeatMapData>(
				queryKeys.seats.map(showtimeId),
				(current) => {
					if (!current) return current;

					const keptLocks = current.activeLocks.filter(
						(lock) => lock.user_id !== variables.userId,
					);

					const optimisticLocks: SeatLock[] = variables.seatIds.map(
						(seatId, index) => ({
							id: -(Date.now() + index),
							showtime_id: variables.showtimeId,
							seat_id: seatId,
							user_id: variables.userId,
							locked_until: lockedUntil,
						}),
					);

					return {
						...current,
						activeLocks: [...keptLocks, ...optimisticLocks],
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
