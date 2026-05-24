import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAdminBookings } from '../hooks/useAdminBookings.ts';
import { useMoviesAdmin } from '../hooks/useMoviesAdmin.ts';
import { useScreensAdmin } from '../hooks/useScreensAdmin.ts';
import { useShowtimesAdmin } from '../hooks/useShowtimesAdmin.ts';
import { LoadingState } from '../ui/LoadingState.tsx';
import {
	formatCurrency,
	formatDateTimeLabel,
	toDateTimeLocalValue,
} from '../utils/date.ts';
import { DEFAULT_TICKET_PRICE } from '../utils/constants.ts';
import type { Movie, Screen, ShowtimeWithDetails } from '../utils/types.ts';
import Panel from '../ui/Panel.tsx';
import TextButton from '../ui/TextButton.tsx';
import Field from '../ui/Field.tsx';

type AdminTab = 'movies' | 'screens' | 'showtimes' | 'analytics';

function inputClasses() {
	return 'rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-orange-300';
}

// This is the admin page component
export function AdminPage() {
	const [activeTab, setActiveTab] = useState<AdminTab>('movies');
	const movies = useMoviesAdmin();
	const screens = useScreensAdmin();
	const showtimes = useShowtimesAdmin();
	const bookings = useAdminBookings();

	const [movieForm, setMovieForm] = useState({
		title: '',
		duration: '120',
		description: '',
	});
	const [editingMovieId, setEditingMovieId] = useState<number | null>(null);

	const [screenForm, setScreenForm] = useState({
		name: '',
		totalRows: '8',
		seatsPerRow: '10',
	});
	const [editingScreenId, setEditingScreenId] = useState<number | null>(null);

	const [showtimeForm, setShowtimeForm] = useState({
		movieId: '',
		screenId: '',
		startTime: '',
		basePrice: String(DEFAULT_TICKET_PRICE),
	});
	const [editingShowtimeId, setEditingShowtimeId] = useState<number | null>(
		null,
	);

	const [adminMessage, setAdminMessage] = useState<string | null>(null);
	const [adminError, setAdminError] = useState<string | null>(null);

	const totalIncome = useMemo(
		() =>
			(bookings.data ?? [])
				.filter((booking) => booking.status === 'confirmed')
				.reduce((sum, booking) => sum + booking.total_price, 0),
		[bookings.data],
	);

	const occupancyRows = useMemo(() => {
		const seatCountsByShowtime = new Map<number, number>();

		for (const booking of bookings.data ?? []) {
			if (booking.status !== 'confirmed') {
				continue;
			}

			const nextCount =
				(seatCountsByShowtime.get(booking.showtime_id) ?? 0) +
				booking.booking_seats.length;
			seatCountsByShowtime.set(booking.showtime_id, nextCount);
		}

		return (showtimes.data ?? []).map((showtime) => {
			const capacity =
				(showtime.screen?.total_rows ?? 0) *
				(showtime.screen?.seats_per_row ?? 0);
			const occupiedSeats = seatCountsByShowtime.get(showtime.id) ?? 0;
			const occupancy =
				capacity > 0 ? Math.round((occupiedSeats / capacity) * 100) : 0;

			return {
				showtime,
				occupiedSeats,
				capacity,
				occupancy,
			};
		});
	}, [bookings.data, showtimes.data]);

	if (
		movies.isLoading ||
		screens.isLoading ||
		showtimes.isLoading ||
		bookings.isLoading
	) {
		return <LoadingState message='Loading admin dashboard...' />;
	}

	if (
		movies.isError ||
		screens.isError ||
		showtimes.isError ||
		bookings.isError
	) {
		return (
			<div className='rounded-[1.75rem] border border-rose-300/20 bg-rose-400/10 p-6 text-sm text-rose-100'>
				Unable to load the admin dashboard. Please verify your admin
				permissions and Supabase table policies.
			</div>
		);
	}

	function resetMovieForm() {
		setMovieForm({
			title: '',
			duration: '120',
			description: '',
		});
		setEditingMovieId(null);
	}

	function resetScreenForm() {
		setScreenForm({
			name: '',
			totalRows: '8',
			seatsPerRow: '10',
		});
		setEditingScreenId(null);
	}

	function resetShowtimeForm() {
		setShowtimeForm({
			movieId: '',
			screenId: '',
			startTime: '',
			basePrice: String(DEFAULT_TICKET_PRICE),
		});
		setEditingShowtimeId(null);
	}

	function showFeedback(message: string) {
		setAdminError(null);
		setAdminMessage(message);
	}

	function showFailure(error: unknown) {
		setAdminMessage(null);
		setAdminError(
			error instanceof Error
				? error.message
				: 'An unexpected admin error occurred.',
		);
	}

	function selectTab(tab: AdminTab) {
		setActiveTab(tab);
		setAdminMessage(null);
		setAdminError(null);
	}

	async function handleMovieSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const values = {
			title: movieForm.title.trim(),
			duration: Number(movieForm.duration),
			description: movieForm.description.trim() || null,
		};

		try {
			if (editingMovieId) {
				await movies.updateMovie.mutateAsync({
					movieId: editingMovieId,
					values,
				});
				showFeedback('Movie updated successfully.');
			} else {
				await movies.createMovie.mutateAsync(values);
				showFeedback('Movie created successfully.');
			}
			resetMovieForm();
		} catch (error) {
			showFailure(error);
		}
	}

	async function handleScreenSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const values = {
			name: screenForm.name.trim(),
			total_rows: Number(screenForm.totalRows),
			seats_per_row: Number(screenForm.seatsPerRow),
		};

		try {
			if (editingScreenId) {
				await screens.updateScreen.mutateAsync({
					screenId: editingScreenId,
					values,
				});
				showFeedback('Screen updated successfully.');
			} else {
				await screens.createScreen.mutateAsync(values);
				showFeedback('Screen created successfully.');
			}
			resetScreenForm();
		} catch (error) {
			showFailure(error);
		}
	}

	async function handleShowtimeSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const values = {
			movie_id: Number(showtimeForm.movieId),
			screen_id: Number(showtimeForm.screenId),
			start_time: new Date(showtimeForm.startTime).toISOString(),
			base_price: Number(showtimeForm.basePrice) || DEFAULT_TICKET_PRICE,
		};

		try {
			if (editingShowtimeId) {
				await showtimes.updateShowtime.mutateAsync({
					showtimeId: editingShowtimeId,
					values,
				});
				showFeedback('Showtime updated successfully.');
			} else {
				await showtimes.createShowtime.mutateAsync(values);
				showFeedback('Showtime created successfully.');
			}
			resetShowtimeForm();
		} catch (error) {
			showFailure(error);
		}
	}

	function startMovieEdit(movie: Movie) {
		setEditingMovieId(movie.id);
		setMovieForm({
			title: movie.title,
			duration: String(movie.duration),
			description: movie.description ?? '',
		});
	}

	function startScreenEdit(screen: Screen) {
		setEditingScreenId(screen.id);
		setScreenForm({
			name: screen.name,
			totalRows: String(screen.total_rows),
			seatsPerRow: String(screen.seats_per_row),
		});
	}

	function startShowtimeEdit(showtime: ShowtimeWithDetails) {
		setEditingShowtimeId(showtime.id);
		setShowtimeForm({
			movieId: String(showtime.movie_id),
			screenId: String(showtime.screen_id),
			startTime: toDateTimeLocalValue(showtime.start_time),
			basePrice: String(showtime.base_price),
		});
	}

	return (
		<section className='space-y-6'>
			<div className='rounded-4xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/25 sm:p-8'>
				<p className='text-xs font-semibold uppercase tracking-[0.28em] text-orange-200'>
					Admin dashboard
				</p>
				<h2 className='mt-3 text-3xl font-semibold text-white'>
					Manage content and monitor bookings
				</h2>
				<p className='mt-3 max-w-3xl text-sm leading-6 text-slate-300'>
					Use the sections below to maintain movies, screens, and
					showtimes, then review booking totals and occupancy for each
					show.
				</p>
			</div>

			<div className='flex flex-wrap items-start gap-3'>
				{(
					['movies', 'screens', 'showtimes', 'analytics'] as AdminTab[]
				).map((tab) => (
					<button
						key={tab}
						type='button'
						onClick={() => selectTab(tab)}
						className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition cursor-pointer ${
							activeTab === tab
								? 'bg-orange-400 text-slate-950'
								: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
						}`}
					>
						{tab}
					</button>
				))}
			</div>

			{adminMessage ? (
				<div className='rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100'>
					{adminMessage}
				</div>
			) : null}

			{adminError ? (
				<div className='rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100'>
					{adminError}
				</div>
			) : null}

			{activeTab === 'movies' ? (
				<Panel
					title='Movies'
					description='Create, update, and remove movie information used across showtimes.'
				>
					<div className='grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]'>
						<form
							onSubmit={(event) => void handleMovieSubmit(event)}
							className='grid w-full content-start gap-4'
						>
							<Field label='Title'>
								<input
									value={movieForm.title}
									onChange={(event) =>
										setMovieForm((current) => ({
											...current,
											title: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<Field label='Duration (minutes)'>
								<input
									type='number'
									min={1}
									value={movieForm.duration}
									onChange={(event) =>
										setMovieForm((current) => ({
											...current,
											duration: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<Field label='Description'>
								<textarea
									value={movieForm.description}
									onChange={(event) =>
										setMovieForm((current) => ({
											...current,
											description: event.target.value,
										}))
									}
									className={`${inputClasses()} min-h-28`}
								/>
							</Field>
							<div className='flex flex-wrap items-start gap-3'>
								<TextButton
									type='submit'
									className='shrink-0 bg-orange-400 text-slate-950 hover:bg-orange-300 cursor-pointer'
									disabled={
										movies.createMovie.isPending ||
										movies.updateMovie.isPending
									}
								>
									{editingMovieId ? 'Update movie' : 'Create movie'}
								</TextButton>
								{editingMovieId ? (
									<TextButton
										onClick={resetMovieForm}
										className='shrink-0 border border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer'
									>
										Cancel edit
									</TextButton>
								) : null}
							</div>
						</form>

						<div className='min-h-0 w-full max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto overscroll-y-contain pr-1'>
							{movies.data?.map((movie) => (
								<article
									key={movie.id}
									className='rounded-3xl border border-white/10 bg-slate-950/60 p-4'
								>
									<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
										<div>
											<h4 className='text-lg font-semibold text-white'>
												{movie.title}
											</h4>
											<p className='mt-1 text-sm text-slate-400'>
												{movie.duration} minutes
											</p>
											<p className='mt-3 text-sm leading-6 text-slate-300'>
												{movie.description ||
													'No description added yet.'}
											</p>
										</div>
										<div className='flex shrink-0 items-start gap-2'>
											<TextButton
												onClick={() => startMovieEdit(movie)}
												className='shrink-0 border border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer'
											>
												Edit
											</TextButton>
											<TextButton
												onClick={() =>
													void movies.deleteMovie
														.mutateAsync(movie.id)
														.then(() =>
															showFeedback(
																'Movie deleted successfully.',
															),
														)
														.catch(showFailure)
												}
												className='shrink-0 border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 cursor-pointer'
											>
												Delete
											</TextButton>
										</div>
									</div>
								</article>
							))}
						</div>
					</div>
				</Panel>
			) : null}

			{activeTab === 'screens' ? (
				<Panel
					title='Screens'
					description='Manage theatre screens and their row and seat counts.'
				>
					<div className='grid items-start gap-6 xl:grid-cols-[0.85fr_1.15fr]'>
						<form
							onSubmit={(event) => void handleScreenSubmit(event)}
							className='grid w-full content-start gap-4'
						>
							<Field label='Screen name'>
								<input
									value={screenForm.name}
									onChange={(event) =>
										setScreenForm((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<Field label='Total rows'>
								<input
									type='number'
									min={1}
									value={screenForm.totalRows}
									onChange={(event) =>
										setScreenForm((current) => ({
											...current,
											totalRows: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<Field label='Seats per row'>
								<input
									type='number'
									min={1}
									value={screenForm.seatsPerRow}
									onChange={(event) =>
										setScreenForm((current) => ({
											...current,
											seatsPerRow: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<div className='flex flex-wrap items-start gap-3'>
								<TextButton
									type='submit'
									className='shrink-0 bg-orange-400 text-slate-950 hover:bg-orange-300 cursor-pointer'
									disabled={
										screens.createScreen.isPending ||
										screens.updateScreen.isPending
									}
								>
									{editingScreenId ? 'Update screen' : 'Create screen'}
								</TextButton>
								{editingScreenId ? (
									<TextButton
										onClick={resetScreenForm}
										className='shrink-0 border border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer'
									>
										Cancel edit
									</TextButton>
								) : null}
							</div>
						</form>

						<div className='min-h-0 w-full max-h-[min(70vh,32rem)] grid gap-4 overflow-y-auto overscroll-y-contain pr-1 sm:grid-cols-2'>
							{screens.data?.map((screen) => (
								<article
									key={screen.id}
									className='rounded-3xl border border-white/10 bg-slate-950/60 p-4'
								>
									<p className='text-xs font-semibold uppercase tracking-[0.28em] text-orange-200'>
										{screen.total_rows * screen.seats_per_row} seats
									</p>
									<h4 className='mt-2 text-lg font-semibold text-white'>
										{screen.name}
									</h4>
									<p className='mt-2 text-sm text-slate-300'>
										{screen.total_rows} rows • {screen.seats_per_row}{' '}
										seats per row
									</p>
									<div className='mt-4 flex shrink-0 items-start gap-2'>
										<TextButton
											onClick={() => startScreenEdit(screen)}
											className='shrink-0 border border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer'
										>
											Edit
										</TextButton>
										<TextButton
											onClick={() =>
												void screens.deleteScreen
													.mutateAsync(screen.id)
													.then(() =>
														showFeedback(
															'Screen deleted successfully.',
														),
													)
													.catch(showFailure)
											}
											className='shrink-0 border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 cursor-pointer'
										>
											Delete
										</TextButton>
									</div>
								</article>
							))}
						</div>
					</div>
				</Panel>
			) : null}

			{activeTab === 'showtimes' ? (
				<Panel
					title='Showtimes'
					description='Link movies to screens and schedule their start times.'
				>
					<div className='grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]'>
						<form
							onSubmit={(event) => void handleShowtimeSubmit(event)}
							className='grid w-full content-start gap-4'
						>
							<Field label='Movie'>
								<select
									value={showtimeForm.movieId}
									onChange={(event) =>
										setShowtimeForm((current) => ({
											...current,
											movieId: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								>
									<option value=''>Select a movie</option>
									{movies.data?.map((movie) => (
										<option key={movie.id} value={movie.id}>
											{movie.title}
										</option>
									))}
								</select>
							</Field>
							<Field label='Screen'>
								<select
									value={showtimeForm.screenId}
									onChange={(event) =>
										setShowtimeForm((current) => ({
											...current,
											screenId: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								>
									<option value=''>Select a screen</option>
									{screens.data?.map((screen) => (
										<option key={screen.id} value={screen.id}>
											{screen.name}
										</option>
									))}
								</select>
							</Field>
							<Field label='Start time'>
								<input
									type='datetime-local'
									value={showtimeForm.startTime}
									onChange={(event) =>
										setShowtimeForm((current) => ({
											...current,
											startTime: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<Field label='Base ticket price'>
								<input
									type='number'
									min={1}
									step='0.01'
									value={showtimeForm.basePrice}
									onChange={(event) =>
										setShowtimeForm((current) => ({
											...current,
											basePrice: event.target.value,
										}))
									}
									className={inputClasses()}
									required
								/>
							</Field>
							<div className='flex flex-wrap items-start gap-3'>
								<TextButton
									type='submit'
									className='shrink-0 bg-orange-400 text-slate-950 hover:bg-orange-300 cursor-pointer'
									disabled={
										showtimes.createShowtime.isPending ||
										showtimes.updateShowtime.isPending
									}
								>
									{editingShowtimeId
										? 'Update showtime'
										: 'Create showtime'}
								</TextButton>
								{editingShowtimeId ? (
									<TextButton
										onClick={resetShowtimeForm}
										className='shrink-0 border border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer'
									>
										Cancel edit
									</TextButton>
								) : null}
							</div>
						</form>

						<div className='min-h-0 w-full max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto overscroll-y-contain pr-1'>
							{showtimes.data?.map((showtime) => (
								<article
									key={showtime.id}
									className='rounded-3xl border border-white/10 bg-slate-950/60 p-4'
								>
									<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
										<div>
											<h4 className='text-lg font-semibold text-white'>
												{showtime.movie?.title ?? 'Movie'} •{' '}
												{showtime.screen?.name ?? 'Screen'}
											</h4>
											<p className='mt-2 text-sm text-slate-300'>
												{formatDateTimeLabel(showtime.start_time)}
											</p>
											<p className='mt-1 text-sm text-slate-400'>
												Base price:{' '}
												{formatCurrency(showtime.base_price)}
											</p>
										</div>
										<div className='flex shrink-0 items-start gap-2'>
											<TextButton
												onClick={() => startShowtimeEdit(showtime)}
												className='shrink-0 border border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer'
											>
												Edit
											</TextButton>
											<TextButton
												onClick={() =>
													void showtimes.deleteShowtime
														.mutateAsync(showtime.id)
														.then(() =>
															showFeedback(
																'Showtime deleted successfully.',
															),
														)
														.catch(showFailure)
												}
												className='shrink-0 border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 cursor-pointer'
											>
												Delete
											</TextButton>
										</div>
									</div>
								</article>
							))}
						</div>
					</div>
				</Panel>
			) : null}

			{activeTab === 'analytics' ? (
				<div className='grid gap-6'>
					<Panel
						title='Income summary'
						description='Confirmed bookings only are counted toward total income.'
					>
						<div className='grid gap-4 md:grid-cols-3'>
							<div className='rounded-3xl border border-white/10 bg-slate-950/60 p-5'>
								<p className='text-sm text-slate-400'>
									Confirmed bookings
								</p>
								<p className='mt-2 text-3xl font-semibold text-white'>
									{
										(bookings.data ?? []).filter(
											(booking) => booking.status === 'confirmed',
										).length
									}
								</p>
							</div>
							<div className='rounded-3xl border border-white/10 bg-slate-950/60 p-5'>
								<p className='text-sm text-slate-400'>Total income</p>
								<p className='mt-2 text-3xl font-semibold text-white'>
									{formatCurrency(totalIncome)}
								</p>
							</div>
							<div className='rounded-3xl border border-white/10 bg-slate-950/60 p-5'>
								<p className='text-sm text-slate-400'>
									Scheduled showtimes
								</p>
								<p className='mt-2 text-3xl font-semibold text-white'>
									{showtimes.data?.length ?? 0}
								</p>
							</div>
						</div>
					</Panel>

					<Panel
						title='Seat occupancy'
						description='Occupancy is calculated from confirmed seats against each screen capacity.'
					>
						<div className='grid gap-4 lg:grid-cols-2'>
							{occupancyRows.map(
								({ showtime, occupiedSeats, capacity, occupancy }) => (
									<article
										key={showtime.id}
										className='rounded-3xl border border-white/10 bg-slate-950/60 p-4'
									>
										<div className='flex items-start justify-between gap-4'>
											<div>
												<h4 className='text-lg font-semibold text-white'>
													{showtime.movie?.title ?? 'Movie'} •{' '}
													{showtime.screen?.name ?? 'Screen'}
												</h4>
												<p className='mt-2 text-sm text-slate-300'>
													{formatDateTimeLabel(
														showtime.start_time,
													)}
												</p>
											</div>
											<div className='rounded-full bg-orange-400/10 px-3 py-2 text-sm font-semibold text-orange-100'>
												{occupancy}%
											</div>
										</div>
										<div className='mt-4 h-3 rounded-full bg-white/10'>
											<div
												className='h-full rounded-full bg-orange-400'
												style={{
													width: `${Math.min(100, occupancy)}%`,
												}}
											/>
										</div>
										<p className='mt-3 text-sm text-slate-400'>
											{occupiedSeats} booked seats out of{' '}
											{capacity || 0} total seats
										</p>
									</article>
								),
							)}
						</div>
					</Panel>

					<Panel
						title='Bookings'
						description='Recent bookings across all users and showtimes.'
					>
						<div className='overflow-x-auto'>
							<table className='min-w-full text-left text-sm text-slate-200'>
								<thead className='border-b border-white/10 text-xs uppercase tracking-[0.24em] text-slate-400'>
									<tr>
										<th className='px-3 py-3'>User</th>
										<th className='px-3 py-3'>Showtime</th>
										<th className='px-3 py-3'>Seats</th>
										<th className='px-3 py-3'>Status</th>
										<th className='px-3 py-3'>Total</th>
										<th className='px-3 py-3'>Created</th>
									</tr>
								</thead>
								<tbody>
									{bookings.data?.map((booking) => (
										<tr
											key={booking.id}
											className='border-b border-white/5'
										>
											<td className='px-3 py-4'>
												<p className='font-medium text-white'>
													{booking.profile?.full_name ||
														booking.profile?.email ||
														booking.user_id}
												</p>
												<p className='text-xs text-slate-400'>
													{booking.profile?.role ?? 'user'}
												</p>
											</td>
											<td className='px-3 py-4'>
												<p className='font-medium text-white'>
													{booking.showtime?.movie?.title ??
														'Movie'}{' '}
													•{' '}
													{booking.showtime?.screen?.name ??
														'Screen'}
												</p>
												<p className='text-xs text-slate-400'>
													{booking.showtime
														? formatDateTimeLabel(
																booking.showtime.start_time,
															)
														: 'Unknown showtime'}
												</p>
											</td>
											<td className='px-3 py-4'>
												{booking.booking_seats.length}
												{booking.admin_override_used ? (
													<p className='mt-1 text-xs text-orange-200'>
														Admin override
													</p>
												) : null}
											</td>
											<td className='px-3 py-4'>
												<span className='rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100'>
													{booking.status}
												</span>
											</td>
											<td className='px-3 py-4'>
												{formatCurrency(booking.total_price)}
											</td>
											<td className='px-3 py-4 text-slate-400'>
												{formatDateTimeLabel(booking.created_at)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Panel>
				</div>
			) : null}
		</section>
	);
}
