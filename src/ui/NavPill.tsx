import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

// This is a reusable component for the navigation pills
function NavPill({ to, children }: { to: string; children: ReactNode }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				[
					'rounded-full px-4 py-2 text-sm font-medium transition',
					isActive
						? 'bg-orange-400 text-slate-950'
						: 'text-slate-200 hover:bg-white/10',
				].join(' ')
			}
		>
			{children}
		</NavLink>
	);
}

export default NavPill;
