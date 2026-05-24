import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './features/auth/AdminRoute.tsx';
import { ProtectedRoute } from './features/auth/ProtectedRoute.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { BookingPage } from './pages/BookingPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import AppLayout from './ui/AppLayout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';

function NotFoundPage() {
	return <Navigate to='/' replace />;
}

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route index element={<HomePage />} />
				<Route path='/login' element={<LoginPage />} />
				<Route element={<ProtectedRoute />}>
					<Route path='/booking/:showtimeId' element={<BookingPage />} />
				</Route>
				<Route element={<AdminRoute />}>
					<Route path='/admin' element={<AdminPage />} />
				</Route>
				<Route path='*' element={<NotFoundPage />} />
			</Route>
		</Routes>
	);
}

export default App;
