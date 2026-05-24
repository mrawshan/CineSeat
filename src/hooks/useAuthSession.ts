import { useContext } from 'react';
import { AuthContext } from '../features/auth/auth-context.ts';

// Hook for the auth session
// Provides the auth session context
// The context is used to access the auth session
export function useAuthSession() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error('useAuthSession must be used within AuthProvider.');
	}

	return context;
}
