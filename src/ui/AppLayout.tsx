import { Outlet } from 'react-router-dom';
import AppShell from './AppShell';

// This is the main layout component for the application
function AppLayout() {
	return (
		<AppShell>
			{/* Here we are taking the nested route using <Outlet/> */}
			<Outlet />
		</AppShell>
	);
}

export default AppLayout;
