import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createMovie,
	deleteMovie,
	fetchMovies,
	updateMovie,
} from '../services/adminService.ts';
import { queryKeys } from '../services/queryKeys.ts';

// Hook for the movies admin page
// Provides the movies query and mutations
// The query fetches the movies and the mutations create, update, and delete movies
// It invalidates the movies query when the mutation is successful
export function useMoviesAdmin() {
	const queryClient = useQueryClient();

	const moviesQuery = useQuery({
		queryKey: queryKeys.admin.movies,
		queryFn: fetchMovies,
	});

	const refreshMovies = () =>
		queryClient.invalidateQueries({
			queryKey: queryKeys.admin.movies,
		});

	return {
		...moviesQuery,
		createMovie: useMutation({
			mutationFn: createMovie,
			onSuccess: refreshMovies,
		}),
		updateMovie: useMutation({
			mutationFn: ({
				movieId,
				values,
			}: {
				movieId: number;
				values: Parameters<typeof updateMovie>[1];
			}) => updateMovie(movieId, values),
			onSuccess: refreshMovies,
		}),
		deleteMovie: useMutation({
			mutationFn: deleteMovie,
			onSuccess: refreshMovies,
		}),
	};
}
