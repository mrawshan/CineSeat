import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthSession } from '../../hooks/useAuthSession.ts';
import { LoadingState } from '../../ui/LoadingState.tsx';

export function ProtectedRoute() {
	const location = useLocation();
	const { isAuthenticated, isLoading } = useAuthSession();

	if (isLoading) {
		return <LoadingState message="Checking your session..." />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/" replace state={{ from: location.pathname }} />;
	}

	return <Outlet />;
}
