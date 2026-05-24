import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
	getCurrentSession,
	signInWithGoogle,
	signInWithPassword,
	signOutUser,
	subscribeToAuthChanges,
} from '../../services/authService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import { ensureProfileFromUser } from '../../services/profileService.ts';
import type { AuthContextValue } from '../../utils/types.ts';
import { AuthContext } from './auth-context.ts';

// Root provider: session from Supabase + profile from DB, exposed to the tree via AuthContext.
export function AuthProvider({ children }: { children: ReactNode }) {
	// Used inside the auth listener to invalidate queries when session or user id changes
	const queryClient = useQueryClient();

	// Current Supabase session (null when signed out); drives isAuthenticated and profile fetch
	const [session, setSession] = useState<Session | null>(null);

	// False until the first getCurrentSession() finishes (success or failure) so UI can show a loading gate
	const [isSessionReady, setIsSessionReady] = useState(false);

	useEffect(() => {
		// Avoid setState after unmount if getCurrentSession resolves late
		let isMounted = true;

		// Hydrate session from persisted storage / Supabase on first paint
		void getCurrentSession()
			.then((activeSession) => {
				if (isMounted) {
					setSession(activeSession); // May be null if no user
					setIsSessionReady(true); // Allow routes that depend on auth to render
				}
			})
			.catch(() => {
				// Still unblock the app; session stays null
				if (isMounted) {
					setIsSessionReady(true);
				}
			});

		// Keep React state in sync when user signs in, signs out, or token refreshes elsewhere
		const {
			data: { subscription },
		} = subscribeToAuthChanges((_event, nextSession) => {
			setSession(nextSession); // Update consumers (ProtectedRoute, header, etc.)

			// Drop any cached session-dependent data so hooks refetch with the new user
			void queryClient.invalidateQueries({
				queryKey: queryKeys.auth.session,
			});

			// Profile is keyed by user id; refetch role/name when user changes
			if (nextSession?.user) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.auth.profile(nextSession.user.id),
				});
			}
		});

		return () => {
			isMounted = false; // Stop applying results from the initial session promise
			subscription.unsubscribe(); // Remove Supabase auth listener to avoid leaks
		};
	}, [queryClient]); // queryClient is stable in production; included for exhaustive-deps correctness

	// Load or create the profiles row for the current user (role, display name); disabled when logged out
	const profileQuery = useQuery({
		queryKey: queryKeys.auth.profile(session?.user.id ?? 'anonymous'),
		queryFn: () => ensureProfileFromUser(session!.user),
		enabled: Boolean(session?.user),
	});

	// Memoize so context consumers do not re-render on every parent render when fields are unchanged
	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user: session?.user ?? null,
			profile: profileQuery.data ?? null,
			isAuthenticated: Boolean(session?.user),
			isAdmin: profileQuery.data?.role === 'admin',
			isLoading:
				!isSessionReady ||
				(Boolean(session?.user) && profileQuery.isLoading),
			signInWithGoogle,
			signInWithPassword,
			signOut: signOutUser,
		}),
		[isSessionReady, profileQuery.data, profileQuery.isLoading, session],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
