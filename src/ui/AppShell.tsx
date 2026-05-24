import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NavPill from './NavPill';
import { useAuthSession } from '../hooks/useAuthSession.ts';

// This is the main shell component for the application
function AppShell({ children }: { children: ReactNode }) {
	const location = useLocation();
	const { isAdmin, isAuthenticated, profile, signInWithGoogle, signOut } =
		useAuthSession();

	return (
		<div className='min-h-screen'>
			<header className='border-b border-white/10 bg-slate-950/60 backdrop-blur'>
				<div className='mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8'>
					<div className='flex items-center justify-between gap-4'>
						<Link to='/' className='flex items-center gap-3'>
							<div className='grid h-11 w-11 place-items-center rounded-2xl bg-orange-400 text-lg font-bold text-slate-950 shadow-lg shadow-orange-950/30'>
								CS
							</div>
							<div>
								<p className='text-xs uppercase tracking-[0.35em] text-orange-200/80'>
									CineSeat
								</p>
								<h1 className='text-lg font-semibold text-white'>
									Theatre seating allocation
								</h1>
							</div>
						</Link>
						<div className='hidden items-center gap-2 lg:flex'>
							<NavPill to='/'>Browse</NavPill>
							{isAdmin ? <NavPill to='/admin'>Admin</NavPill> : null}
						</div>
					</div>
					<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
						<div className='min-w-0'>
							{isAuthenticated ? (
								<>
									<p className='truncate text-sm font-medium text-white'>
										{profile?.full_name ||
											profile?.email ||
											'Signed in'}
									</p>
									<p className='text-xs uppercase tracking-[0.28em] text-slate-400'>
										{profile?.role ?? 'user'}
									</p>
								</>
							) : (
								<p className='text-sm text-slate-300'>
									Sign in to browse shows and book seats.
								</p>
							)}
						</div>
						<div className='flex items-center gap-2'>
							<div className='flex items-center gap-2 lg:hidden'>
								<NavPill to='/'>Browse</NavPill>
								{isAdmin ? <NavPill to='/admin'>Admin</NavPill> : null}
							</div>
							{isAuthenticated ? (
								<button
									type='button'
									onClick={() => void signOut()}
									className='rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-orange-200/40 hover:bg-white/10'
								>
									Sign out
								</button>
							) : (
								<>
									<Link
										to='/login'
										state={location.state}
										className='rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-orange-200/40 hover:bg-white/10'
									>
										Log in
									</Link>
									<button
										type='button'
										onClick={() => void signInWithGoogle()}
										className='rounded-full bg-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 cursor-pointer'
									>
										Continue with Google
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			</header>
			<main className='mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8'>
				{children}
			</main>
		</div>
	);
}

export default AppShell;
