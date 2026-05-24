import { useAuthSession } from './useAuthSession.ts';

// Hook for the profile
// Provides the profile and isAdmin
// The profile is the user's profile
// The isAdmin is a boolean indicating if the user is an admin
export function useProfile() {
	const { profile, isAdmin } = useAuthSession();

	return {
		profile,
		isAdmin,
	};
}
