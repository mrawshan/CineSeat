import { useQuery } from '@tanstack/react-query';
import { SEAT_REFRESH_INTERVAL_MS } from '../utils/constants.ts';
import { queryKeys } from '../services/queryKeys.ts';
import { fetchSeatMap } from '../services/showtimeService.ts';

// Hook for the seat map
// Provides the seat map query
// The query fetches the seat map
// It invalidates the seat map query every 10 seconds
export function useSeatMap(showtimeId: number) {
	return useQuery({
		queryKey: queryKeys.seats.map(showtimeId),
		queryFn: () => fetchSeatMap(showtimeId),
		enabled: Number.isFinite(showtimeId) && showtimeId > 0,
		refetchInterval: SEAT_REFRESH_INTERVAL_MS, // Refetch the seat map every 10 seconds
	});
}
