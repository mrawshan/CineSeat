import type { AuthError } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthSession } from '../hooks/useAuthSession.ts';
import Field from '../ui/Field.tsx';
import { LoadingState } from '../ui/LoadingState.tsx';

type LocationState = { from?: string };

export function LoginPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { isAuthenticated, isLoading, signInWithPassword } = useAuthSession();
	const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL ?? '');
	const [password, setPassword] = useState(
		import.meta.env.VITE_ADMIN_PASSWORD ?? '',
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const from = (location.state as LocationState | null)?.from;

	if (isLoading) {
		return <LoadingState message='Checking your session…' />;
	}

	if (isAuthenticated) {
		return <Navigate to={from ?? '/'} replace />;
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage(null);
		setIsSubmitting(true);

		try {
			await signInWithPassword({ email: email.trim(), password });
			navigate(from ?? '/', { replace: true });
		} catch (error) {
			const message =
				(error as AuthError).message ?? 'Could not sign in. Try again.';
			setErrorMessage(message);
		} finally {
			setIsSubmitting(false);
		}
	}

	const inputClassName =
		'rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-300/60 focus:ring-2 focus:ring-orange-400/25';

	return (
		<section className='mx-auto max-w-md'>
			<div className='rounded-4xl border border-orange-200/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/25 sm:p-8'>
				<p className='mb-3 inline-flex rounded-full border border-orange-200/15 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-orange-200'>
					Sign in
				</p>
				<h2 className='text-2xl font-semibold text-white sm:text-3xl'>
					Log in with email
				</h2>
				<p className='mt-3 text-sm leading-6 text-slate-300'>
					Use the email and password for your CineSeat account.
				</p>

				<form
					className='mt-8 grid gap-5'
					onSubmit={(e) => void handleSubmit(e)}
				>
					<Field label='Email'>
						<input
							type='email'
							name='email'
							autoComplete='email'
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClassName}
							placeholder='you@example.com'
						/>
					</Field>
					<Field label='Password'>
						<input
							type='password'
							name='password'
							autoComplete='current-password'
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClassName}
							placeholder='••••••••'
						/>
					</Field>

					{errorMessage ? (
						<p
							className='rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200'
							role='alert'
						>
							{errorMessage}
						</p>
					) : null}

					<button
						type='submit'
						disabled={isSubmitting}
						className='rounded-full bg-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer'
					>
						{isSubmitting ? 'Signing in…' : 'Log in'}
					</button>
				</form>

				<p className='mt-6 text-center text-sm text-slate-400'>
					<Link
						to='/'
						className='font-medium text-orange-200 underline-offset-4 hover:text-orange-100 hover:underline'
					>
						Back to browse
					</Link>
				</p>
			</div>
		</section>
	);
}
