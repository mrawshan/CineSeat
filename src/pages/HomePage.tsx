import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSession } from '../hooks/useAuthSession.ts';
import { useShowtimesByDate } from '../hooks/useShowtimesByDate.ts';
import {
	formatDateLabel,
	formatDuration,
	formatTimeLabel,
	getTodayDateValue,
	isShowtimeScreeningEnded,
} from '../utils/date.ts';

export function HomePage() {
	const { isAuthenticated, signInWithGoogle } = useAuthSession();
	const [selectedDate, setSelectedDate] = useState(getTodayDateValue);
	const showtimesQuery = useShowtimesByDate(
		isAuthenticated ? selectedDate : '',
	);

	if (!isAuthenticated) {
		return (
			<section className='grid gap-6 lg:grid-cols-[1.25fr_0.75fr]'>
				<div className='rounded-4xl border border-orange-200/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/25 sm:p-8'>
					<p className='mb-3 inline-flex rounded-full border border-orange-200/15 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-orange-200'>
						What&apos;s on at CineSeat
					</p>
					<h2 className='max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-5xl'>
						Pick a film, choose your seats, and get ready for the lights
						to go down.
					</h2>
					<p className='mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base'>
						Browse today&apos;s and upcoming screenings, see what&apos;s
						playing in each auditorium, then lock in the seats you want
						before someone else does. Sign in once and your bookings stay
						with your account.
					</p>
					<div className='mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'>
						<button
							type='button'
							onClick={() => void signInWithGoogle()}
							className='rounded-full bg-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 cursor-pointer'
						>
							Sign in with Google
						</button>
						<p className='text-sm text-slate-400 sm:max-w-xs sm:pl-1'>
							Quick sign-in — no extra password to remember.
						</p>
					</div>
				</div>
				<div className='grid gap-4'>
					{[
						{
							title: 'Browse showtimes',
							description:
								'See films, start times, and screens for the day you care about.',
						},
						{
							title: 'Choose your seats',
							description:
								'Open the seat map, sit together with friends, and hold seats while you confirm.',
						},
						{
							title: 'Book with confidence',
							description:
								'Complete your booking in a few steps and keep everything under one sign-in.',
						},
					].map((item) => (
						<article
							key={item.title}
							className='rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-slate-200 shadow-xl shadow-black/10'
						>
							<h3 className='text-lg font-semibold text-white'>
								{item.title}
							</h3>
							<p className='mt-2 text-sm leading-6 text-slate-300'>
								{item.description}
							</p>
						</article>
					))}
				</div>
			</section>
		);
	}

	return (
		<section className='space-y-6'>
			<div className='rounded-4xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/25 sm:p-8'>
				<div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
					<div>
						<p className='text-xs font-semibold uppercase tracking-[0.28em] text-orange-200'>
							What&apos;s playing
						</p>
						<h2 className='mt-3 text-3xl font-semibold text-white'>
							Choose a day, then pick a screening
						</h2>
						<p className='mt-3 max-w-2xl text-sm leading-6 text-slate-300'>
							We list every film scheduled for the date you select.
							Choose a show to open the seat map and finish your booking.
						</p>
					</div>
					<label className='flex min-w-[220px] flex-col gap-2 text-sm font-medium text-slate-200'>
						<span>Select date</span>
						<input
							type='date'
							value={selectedDate}
							onChange={(event) => setSelectedDate(event.target.value)}
							className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-orange-300'
						/>
					</label>
				</div>
			</div>

			<div className='flex items-center justify-between'>
				<div>
					<h3 className='text-xl font-semibold text-white'>
						{formatDateLabel(selectedDate)}
					</h3>
					<p className='text-sm text-slate-400'>
						Seat availability updates when you open a screening.
					</p>
				</div>
				<p className='text-sm text-slate-400'>
					{showtimesQuery.data?.length ?? 0} showtime
					{showtimesQuery.data?.length === 1 ? '' : 's'}
				</p>
			</div>

			{showtimesQuery.isLoading ? (
				<div className='rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300'>
					Loading available showtimes...
				</div>
			) : showtimesQuery.isError ? (
				<div className='rounded-[1.75rem] border border-rose-300/20 bg-rose-400/10 p-6 text-sm text-rose-100'>
					We couldn&apos;t load showtimes just now. Please try again in a
					moment.
				</div>
			) : showtimesQuery.data && showtimesQuery.data.length > 0 ? (
				<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
					{showtimesQuery.data.map((showtime) => {
						const screeningEnded = isShowtimeScreeningEnded(
							showtime.start_time,
							showtime.movie?.duration,
						);

						return (
							<article
								key={showtime.id}
								className='flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10'
							>
								<div className='flex items-start justify-between gap-4'>
									<div>
										<p className='text-xs font-semibold uppercase tracking-[0.24em] text-orange-200'>
											{showtime.screen?.name ?? 'Screen'}
										</p>
										<h4 className='mt-2 text-xl font-semibold text-white'>
											{showtime.movie?.title ?? 'Movie'}
										</h4>
									</div>
									<div className='rounded-2xl bg-orange-400/15 px-3 py-2 text-right text-sm font-semibold text-orange-100'>
										{formatTimeLabel(showtime.start_time)}
									</div>
								</div>
								<p className='mt-3 text-sm text-slate-300'>
									{showtime.movie?.duration
										? formatDuration(showtime.movie.duration)
										: 'Duration unavailable'}
								</p>
								<p className='mt-3 flex-1 text-sm leading-6 text-slate-400'>
									{showtime.movie?.description ||
										'No description available for this movie yet.'}
								</p>
								{screeningEnded ? (
									<span
										className='mt-5 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-500'
										aria-disabled
									>
										Screening ended
									</span>
								) : (
									<Link
										to={`/booking/${showtime.id}`}
										className='mt-5 inline-flex items-center justify-center rounded-full bg-orange-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300'
									>
										Choose seats
									</Link>
								)}
							</article>
						);
					})}
				</div>
			) : (
				<div className='rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 p-10 text-center'>
					<h3 className='text-lg font-semibold text-white'>
						No showtimes scheduled
					</h3>
					<p className='mt-2 text-sm text-slate-400'>
						There are no movies scheduled for{' '}
						{formatDateLabel(selectedDate)}.
					</p>
				</div>
			)}
		</section>
	);
}
