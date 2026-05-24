import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createScreen,
	deleteScreen,
	fetchScreens,
	updateScreen,
} from '../services/adminService.ts';
import { queryKeys } from '../services/queryKeys.ts';

// Hook for the screens admin page
// Provides the screens query and mutations
// The query fetches the screens and the mutations create, update, and delete screens
export function useScreensAdmin() {
	const queryClient = useQueryClient();

	const screensQuery = useQuery({
		queryKey: queryKeys.admin.screens,
		queryFn: fetchScreens,
	});

	const refreshScreens = () =>
		queryClient.invalidateQueries({
			queryKey: queryKeys.admin.screens,
		});

	return {
		...screensQuery,
		createScreen: useMutation({
			mutationFn: createScreen,
			onSuccess: refreshScreens,
		}),
		updateScreen: useMutation({
			mutationFn: ({
				screenId,
				values,
			}: {
				screenId: number;
				values: Parameters<typeof updateScreen>[1];
			}) => updateScreen(screenId, values),
			onSuccess: refreshScreens,
		}),
		deleteScreen: useMutation({
			mutationFn: deleteScreen,
			onSuccess: refreshScreens,
		}),
	};
}
