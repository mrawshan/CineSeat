import { useQuery } from '@tanstack/react-query';
import { fetchAdminBookings } from '../services/adminService.ts';
import { queryKeys } from '../services/queryKeys.ts';

// Hook for the admin bookings page
// Provides the bookings query
// The query fetches the bookings
export function useAdminBookings() {
	return useQuery({
		queryKey: queryKeys.admin.bookings,
		queryFn: fetchAdminBookings,
	});
}
