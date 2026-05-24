import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys.ts';
import { fetchShowtimesByDate } from '../services/showtimeService.ts';

// Hook for the showtimes by date
// Provides the showtimes by date query
// The query fetches the showtimes by date
// It is enabled only if the date value is not empty
export function useShowtimesByDate(dateValue: string) {
	return useQuery({
		queryKey: queryKeys.showtimes.byDate(dateValue),
		queryFn: () => fetchShowtimesByDate(dateValue), // Fetch the showtimes by date
		enabled: Boolean(dateValue), // Enable the query only if the date value is not empty
	});
}
