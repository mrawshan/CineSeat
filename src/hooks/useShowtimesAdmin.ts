import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createShowtime,
	deleteShowtime,
	fetchAdminShowtimes,
	updateShowtime,
} from '../services/adminService.ts';
import { queryKeys } from '../services/queryKeys.ts';

// Hook for the showtimes admin page
// Provides the showtimes query and mutations
// The query fetches the showtimes and the mutations create, update, and delete showtimes
// It invalidates the showtimes query when the mutation is successful
export function useShowtimesAdmin() {
	const queryClient = useQueryClient();

	const showtimesQuery = useQuery({
		queryKey: queryKeys.showtimes.admin,
		queryFn: fetchAdminShowtimes,
	});

	const refreshShowtimes = () =>
		queryClient.invalidateQueries({
			queryKey: queryKeys.showtimes.admin,
		});

	return {
		...showtimesQuery,
		createShowtime: useMutation({
			mutationFn: createShowtime,
			onSuccess: refreshShowtimes,
		}),
		updateShowtime: useMutation({
			mutationFn: ({
				showtimeId,
				values,
			}: {
				showtimeId: number;
				values: Parameters<typeof updateShowtime>[1];
			}) => updateShowtime(showtimeId, values),
			onSuccess: refreshShowtimes,
		}),
		deleteShowtime: useMutation({
			mutationFn: deleteShowtime,
			onSuccess: refreshShowtimes,
		}),
	};
}
