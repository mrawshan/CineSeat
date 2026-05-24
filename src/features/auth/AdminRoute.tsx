import { Navigate, Outlet } from 'react-router-dom';
import { useAuthSession } from '../../hooks/useAuthSession.ts';
import { LoadingState } from '../../ui/LoadingState.tsx';

export function AdminRoute() {
	const { isAdmin, isAuthenticated, isLoading } = useAuthSession();

	if (isLoading) {
		return <LoadingState message="Checking your admin access..." />;
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
}
