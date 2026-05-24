import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthSession } from '../hooks/useAuthSession.ts';
import { useConfirmBooking } from '../hooks/useConfirmBooking.ts';
import { useLockSeats } from '../hooks/useLockSeats.ts';
import { useReleaseSeats } from '../hooks/useReleaseSeats.ts';
import { useSeatMap } from '../hooks/useSeatMap.ts';
import { useUserBookedSeatsByShowtime } from '../hooks/useUserBookedSeatsByShowtime.ts';
import { LoadingState } from '../ui/LoadingState.tsx';
import {
	MAX_GROUP_SIZE,
	MIN_GROUP_SIZE,
	SEAT_LOCK_MINUTES,
	VIP_PRICE_MULTIPLIER,
} from '../utils/constants.ts';
import { calculateBookingTotal, getSeatTicketPrice } from '../utils/pricing.ts';
import {
	formatCountdown,
	formatCurrency,
	formatDateTimeLabel,
	formatTimeLabel,
	getRowLabel,
} from '../utils/date.ts';
import { findBestSeats } from '../utils/seatAllocator.ts';
import type { Seat, SeatState } from '../utils/types.ts';

// This is a helper function to group seats by row
function groupSeatsByRow(seats: Seat[]) {
	return seats.reduce<Record<number, Seat[]>>((rows, seat) => {
		const rowSeats = rows[seat.row_number] ?? [];
		rowSeats.push(seat);
		rows[seat.row_number] = rowSeats;
		return rows;
	}, {});
}

// This is a helper function to get the state of a seat
function getSeatState(options: {
	seatId: number;
	bookedSeatIds: Set<number>;
	brokenSeatIds: Set<number>;
	lockedSeatIds: Set<number>;
	selectedSeatIds: Set<number>;
	allowBrokenSeats: boolean;
}) {
	if (options.selectedSeatIds.has(options.seatId)) {
		return 'selected' as SeatState;
	}

	if (options.bookedSeatIds.has(options.seatId)) {
		return 'booked' as SeatState;
	}

	if (options.lockedSeatIds.has(options.seatId)) {
		return 'locked' as SeatState;
	}

	if (!options.allowBrokenSeats && options.brokenSeatIds.has(options.seatId)) {
		return 'broken' as SeatState;
	}

	return 'available' as SeatState;
}

// This is a helper function to get the classes for a seat button
function seatButtonClasses(state: SeatState, seat: Seat) {
	switch (state) {
		case 'selected':
			return 'border-orange-200 bg-orange-400 text-slate-950';
		case 'booked':
			return 'border-emerald-300/40 bg-emerald-500/25 text-emerald-50 cursor-not-allowed';
		case 'locked':
			return 'border-amber-200/30 bg-amber-500/20 text-amber-50 cursor-not-allowed';
		case 'broken':
			return 'border-red-300/40 bg-red-500/25 text-red-50 cursor-not-allowed';
		default:
			if (seat.seat_type === 'vip') {
				return 'border-purple-300/40 bg-purple-500/30 text-purple-50 hover:border-purple-200/60 hover:bg-purple-500/40';
			}

			if (seat.seat_type === 'disability') {
				return 'border-sky-300/40 bg-sky-400/25 text-sky-50 hover:border-sky-200/60 hover:bg-sky-400/35';
			}

			return 'border-white/10 bg-white/5 text-white hover:border-orange-200/40 hover:bg-white/10';
	}
}

export function BookingPage() {
	const { showtimeId: showtimeIdParam } = useParams();
	const showtimeId = Number(showtimeIdParam);
	const { user, isAdmin } = useAuthSession();
	const seatMapQuery = useSeatMap(showtimeId);
	const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
	const [groupSize, setGroupSize] = useState(MIN_GROUP_SIZE);
	const [adminOverride, setAdminOverride] = useState(false);
	const [pageError, setPageError] = useState<string | null>(null);
	const [pageMessage, setPageMessage] = useState<string | null>(null);
	const [countdownTick, setCountdownTick] = useState(0);

	const lockSeatsMutation = useLockSeats(showtimeId);
	const {
		mutateAsync: releaseSeatLocksAsync,
		isPending: isReleasingSeatLocks,
	} = useReleaseSeats(showtimeId);
	const confirmBookingMutation = useConfirmBooking(showtimeId);
	const userBookedSeatsQuery = useUserBookedSeatsByShowtime(
		showtimeId,
		user?.id,
	);

	const activeLocks = useMemo(
		() => seatMapQuery.data?.activeLocks ?? [],
		[seatMapQuery.data?.activeLocks],
	);
	const currentUserLocks = useMemo(
		() => activeLocks.filter((seatLock) => seatLock.user_id === user?.id),
		[activeLocks, user?.id],
	);
	const currentUserLockSeatIds = useMemo(
		() => currentUserLocks.map((seatLock) => seatLock.seat_id),
		[currentUserLocks],
	);
	// While we are mutating (locking/releasing), render from local selection.
	// Otherwise, render from the server locks. This stays stable because we
	// optimistically update the seat-map cache in `useLockSeats`.
	const displayedSelectedSeatIds =
		lockSeatsMutation.isPending || isReleasingSeatLocks
			? selectedSeatIds
			: currentUserLockSeatIds;
	const expiryHandledRef = useRef(false);

	useEffect(() => {
		const intervalId = window.setInterval(
			() => setCountdownTick(Date.now()),
			1000,
		);
		return () => window.clearInterval(intervalId);
	}, []);

	const currentUserLockedUntil = useMemo(() => {
		if (currentUserLocks.length === 0) {
			return null;
		}

		return [...currentUserLocks].sort(
			(left, right) =>
				new Date(left.locked_until).getTime() -
				new Date(right.locked_until).getTime(),
		)[0].locked_until;
	}, [currentUserLocks]);

	const remainingSeconds = currentUserLockedUntil
		? countdownTick === 0
			? SEAT_LOCK_MINUTES * 60
			: Math.max(
					0,
					Math.ceil(
						(new Date(currentUserLockedUntil).getTime() - countdownTick) /
							1000,
					),
				)
		: 0;

	useEffect(() => {
		if (currentUserLocks.length === 0) {
			expiryHandledRef.current = false;
			return;
		}

		if (remainingSeconds > 0 || isReleasingSeatLocks || !user) {
			return;
		}

		if (expiryHandledRef.current) {
			return;
		}

		expiryHandledRef.current = true;

		void (async () => {
			try {
				await releaseSeatLocksAsync({
					showtimeId,
					userId: user.id,
					expiredOnly: true,
				});
			} finally {
				setSelectedSeatIds([]);
				setPageMessage(null);
				setPageError(
					'Your seat lock expired, so the selection was released.',
				);
			}
		})();
	}, [
		currentUserLocks.length,
		isReleasingSeatLocks,
		releaseSeatLocksAsync,
		remainingSeconds,
		showtimeId,
		user,
	]);

	const unavailableSeatIds = useMemo(() => {
		const bookedSeatIds = new Set(seatMapQuery.data?.bookedSeatIds ?? []);
		const brokenSeatIds = new Set(
			adminOverride ? [] : (seatMapQuery.data?.brokenSeatIds ?? []),
		);
		const lockedByOthers = activeLocks
			.filter((seatLock) => seatLock.user_id !== user?.id)
			.map((seatLock) => seatLock.seat_id);

		return {
			bookedSeatIds,
			brokenSeatIds,
			lockedSeatIds: new Set(lockedByOthers),
		};
	}, [
		activeLocks,
		adminOverride,
		seatMapQuery.data?.bookedSeatIds,
		seatMapQuery.data?.brokenSeatIds,
		user?.id,
	]);

	const rows = useMemo(
		() => groupSeatsByRow(seatMapQuery.data?.seats ?? []),
		[seatMapQuery.data?.seats],
	);
	const selectedSeatSet = useMemo(
		() => new Set(displayedSelectedSeatIds),
		[displayedSelectedSeatIds],
	);
	const basePrice = seatMapQuery.data?.showtime.base_price ?? 0;
	const seats = seatMapQuery.data?.seats ?? [];
	const vipUnitPrice = basePrice * VIP_PRICE_MULTIPLIER;
	const totalPrice = calculateBookingTotal(
		displayedSelectedSeatIds,
		seats,
		basePrice,
	);

	if (!Number.isFinite(showtimeId) || showtimeId <= 0) {
		return (
			<div className='rounded-[1.75rem] border border-rose-300/20 bg-rose-400/10 p-6 text-sm text-rose-100'>
				Invalid showtime selected.
			</div>
		);
	}

	if (seatMapQuery.isLoading) {
		return <LoadingState message='Loading seat layout...' />;
	}

	if (seatMapQuery.isError || !seatMapQuery.data) {
		return (
			<div className='rounded-[1.75rem] border border-rose-300/20 bg-rose-400/10 p-6 text-sm text-rose-100'>
				Unable to load the seat map. Please verify your showtime, seats, and
				Supabase policies.
			</div>
		);
	}

	const { showtime } = seatMapQuery.data;

	async function applySeatSelection(nextSeatIds: number[], message?: string) {
		if (!user) {
			return;
		}

		setPageError(null);
		setPageMessage(message ?? null);
		setSelectedSeatIds(nextSeatIds);

		try {
			await lockSeatsMutation.mutateAsync({
				showtimeId,
				userId: user.id,
				seatIds: nextSeatIds,
				adminOverride: adminOverride && isAdmin,
			});
		} catch (error) {
			setPageMessage(null);
			setPageError(
				error instanceof Error
					? error.message
					: 'Unable to update seat locks.',
			);
			void seatMapQuery.refetch();
		}
	}

	async function handleSeatClick(seatId: number) {
		if (lockSeatsMutation.isPending) {
			return;
		}

		const isUnavailable =
			unavailableSeatIds.bookedSeatIds.has(seatId) ||
			unavailableSeatIds.lockedSeatIds.has(seatId) ||
			unavailableSeatIds.brokenSeatIds.has(seatId);

		if (isUnavailable) {
			return;
		}

		const nextSeatIds = selectedSeatSet.has(seatId)
			? displayedSelectedSeatIds.filter(
					(selectedSeatId) => selectedSeatId !== seatId,
				)
			: [...displayedSelectedSeatIds, seatId];

		await applySeatSelection(nextSeatIds);
	}

	async function handleAutoPick() {
		const result = findBestSeats(
			seatMapQuery.data?.seats ?? [],
			[
				...(seatMapQuery.data?.bookedSeatIds ?? []),
				...(adminOverride ? [] : (seatMapQuery.data?.brokenSeatIds ?? [])),
				...activeLocks
					.filter((seatLock) => seatLock.user_id !== user?.id)
					.map((seatLock) => seatLock.seat_id),
			],
			{
				groupSize,
				preferAdjacent: true,
			},
		);

		if (result.seatIds.length === 0) {
			setPageMessage(null);
			setPageError(
				'Not enough available seats were found for that group size.',
			);
			return;
		}

		await applySeatSelection(
			result.seatIds,
			result.usedFallback
				? 'Auto-pick used the fallback strategy because adjacent seats were unavailable.'
				: 'Auto-pick found an adjacent seat block for your group.',
		);
	}

	async function handleConfirmBooking() {
		if (!user || displayedSelectedSeatIds.length === 0) {
			return;
		}

		setPageError(null);
		setPageMessage(null);

		try {
			const result = await confirmBookingMutation.mutateAsync({
				showtimeId,
				userId: user.id,
				seatIds: displayedSelectedSeatIds,
				adminOverride: adminOverride && isAdmin,
			});

			setSelectedSeatIds([]);
			setPageMessage(
				`Booking #${result.booking.id} confirmed for ${result.bookingSeats.length} seat${
					result.bookingSeats.length === 1 ? '' : 's'
				}.`,
			);
		} catch (error) {
			setPageError(
				error instanceof Error
					? error.message
					: 'Unable to confirm the booking.',
			);
		}
	}

	return (
		<section className='space-y-6'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<Link
						to='/'
						className='text-sm font-medium text-orange-200 transition hover:text-orange-100'
					>
						← Back to showtimes
					</Link>
					<h2 className='mt-3 text-3xl font-semibold text-white'>
						{showtime.movie?.title ?? 'Movie showtime'}
					</h2>
					<p className='mt-2 text-sm text-slate-300'>
						{showtime.screen?.name ?? 'Screen'} •{' '}
						{formatDateTimeLabel(showtime.start_time)}
					</p>
				</div>
				<div className='rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300'>
					<p className='font-semibold text-white'>
						{formatTimeLabel(showtime.start_time)}
					</p>
					<p>Lock window: 5 minutes</p>
				</div>
			</div>

			<div className='grid gap-6 xl:grid-cols-[1.35fr_0.65fr]'>
				<div className='rounded-4xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/25 sm:p-6'>
					<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
						<div>
							<h3 className='text-xl font-semibold text-white'>
								Choose your seats
							</h3>
							<p className='mt-1 text-sm text-slate-400'>
								Click on the seats you want to book.
							</p>
						</div>
					</div>

					<div className='mt-5 rounded-full bg-linear-to-r from-orange-300/15 via-white/25 to-orange-300/15 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.4em] text-orange-100'>
						Screen
					</div>

					{/* Seat grid */}
					<div className='mt-6 overflow-x-auto'>
						<div className='mx-auto w-fit space-y-3'>
							{Object.entries(rows)
								.sort(([left], [right]) => Number(left) - Number(right))
								.map(([rowNumber, seats]) => (
									<div
										key={rowNumber}
										className='flex min-w-max items-center gap-3'
									>
										<div className='w-10 text-sm font-semibold text-slate-400'>
											{getRowLabel(Number(rowNumber))}
										</div>
										<div className='flex gap-2'>
											{seats.map((seat) => {
												const state = getSeatState({
													seatId: seat.id,
													bookedSeatIds:
														unavailableSeatIds.bookedSeatIds,
													brokenSeatIds:
														unavailableSeatIds.brokenSeatIds,
													lockedSeatIds:
														unavailableSeatIds.lockedSeatIds,
													selectedSeatIds: selectedSeatSet,
													allowBrokenSeats:
														adminOverride && isAdmin,
												});

												return (
													<button
														key={seat.id}
														type='button'
														onClick={() =>
															void handleSeatClick(seat.id)
														}
														disabled={
															state === 'booked' ||
															state === 'locked' ||
															state === 'broken' ||
															lockSeatsMutation.isPending
														}
														className={`h-11 w-11 rounded-2xl border text-xs font-semibold transition ${seatButtonClasses(state, seat)}`}
														title={`${getRowLabel(seat.row_number)}-${seat.seat_number} • ${formatCurrency(getSeatTicketPrice(seat, basePrice))}`}
													>
														{seat.seat_number}
													</button>
												);
											})}
										</div>
									</div>
								))}
						</div>
					</div>

					{/* Seat state indicators */}
					<div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
						{[
							['Regular', 'border-white/10 bg-white/5 text-white'],
							[
								'VIP',
								'border-purple-300/40 bg-purple-500/30 text-purple-50',
							],
							[
								'Disability',
								'border-sky-300/40 bg-sky-400/25 text-sky-50',
							],
							['Broken', 'border-red-300/40 bg-red-500/25 text-red-50'],
							[
								'Selected',
								'border-orange-200 bg-orange-400 text-slate-950',
							],
							[
								'Locked',
								'border-amber-200/30 bg-amber-500/20 text-amber-50',
							],
							[
								'Booked',
								'border-emerald-300/40 bg-emerald-500/25 text-emerald-50',
							],
						].map(([label, classes]) => (
							<div
								key={label}
								className='flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3'
							>
								<div
									className={`h-8 w-8 rounded-xl border ${classes}`}
								/>
								<span className='text-sm text-slate-200'>{label}</span>
							</div>
						))}
					</div>
				</div>

				{/* Seat tools */}
				<aside className='space-y-4'>
					<div className='rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10'>
						<h3 className='text-lg font-semibold text-white'>
							Seat tools
						</h3>
						<p className='mt-2 text-sm text-slate-400'>
							Manual selection is available, or you can let the allocator
							choose the best seats for your group.
						</p>
						<div className='mt-4 flex gap-3'>
							<input
								type='number'
								min={MIN_GROUP_SIZE}
								max={MAX_GROUP_SIZE}
								value={groupSize}
								onChange={(event) =>
									setGroupSize(
										Math.min(
											MAX_GROUP_SIZE,
											Math.max(
												MIN_GROUP_SIZE,
												Number(event.target.value) ||
													MIN_GROUP_SIZE,
											),
										),
									)
								}
								className='w-24 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none transition focus:border-orange-300'
							/>
							<button
								type='button'
								onClick={() => void handleAutoPick()}
								disabled={lockSeatsMutation.isPending}
								className='flex-1 rounded-full border border-orange-200/30 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-400/10 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer'
							>
								Find best seats
							</button>
						</div>
						{isAdmin ? (
							<label className='mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200'>
								<input
									type='checkbox'
									checked={adminOverride}
									onChange={(event) =>
										setAdminOverride(event.target.checked)
									}
									className='h-4 w-4 rounded border-white/20 bg-slate-950 cursor-pointer'
								/>
								Admin override (allow broken seats, still blocks
								confirmed bookings)
							</label>
						) : null}
					</div>

					{/* Booking summary */}
					<div className='rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10'>
						<h3 className='text-lg font-semibold text-white'>
							Booking summary
						</h3>
						<div className='mt-4 space-y-3 text-sm text-slate-300'>
							<div className='flex items-center justify-between'>
								<span>Selected seats</span>
								<span className='font-semibold text-white'>
									{displayedSelectedSeatIds.length}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span>Base price</span>
								<span className='font-semibold text-white'>
									{formatCurrency(basePrice)}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span>VIP price</span>
								<span className='font-semibold text-white'>
									{formatCurrency(vipUnitPrice)}
								</span>
							</div>
							<div className='flex items-center justify-between border-t border-white/10 pt-3'>
								<span>Total price</span>
								<span className='text-lg font-semibold text-white'>
									{formatCurrency(totalPrice)}
								</span>
							</div>
						</div>

						{currentUserLockedUntil ? (
							<div className='mt-5 rounded-2xl border border-orange-200/20 bg-orange-400/10 px-4 py-3 text-sm text-orange-50'>
								Held for you:{' '}
								<span className='font-semibold'>
									{formatCountdown(remainingSeconds)}
								</span>
							</div>
						) : null}

						{pageMessage ? (
							<div className='mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100'>
								{pageMessage}
							</div>
						) : null}

						{pageError ? (
							<div className='mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100'>
								{pageError}
							</div>
						) : null}

						<button
							type='button'
							onClick={() => void handleConfirmBooking()}
							disabled={
								displayedSelectedSeatIds.length === 0 ||
								confirmBookingMutation.isPending ||
								lockSeatsMutation.isPending
							}
							className='mt-5 w-full rounded-full bg-orange-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer'
						>
							{confirmBookingMutation.isPending
								? 'Confirming booking...'
								: 'Confirm booking'}
						</button>
					</div>

					{/* Booked Summary */}
					<div className='rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10'>
						<h3 className='text-lg font-semibold text-white'>
							Booked seats
						</h3>
						<div className='mt-4 space-y-3 text-sm text-slate-300'>
							{userBookedSeatsQuery.isLoading ? (
								<p className='text-slate-400'>Loading your booking…</p>
							) : userBookedSeatsQuery.isError ? (
								<p className='text-rose-200'>
									Unable to load your booked seats.
								</p>
							) : (userBookedSeatsQuery.data ?? []).length === 0 ? (
								<p className='text-slate-400'>
									Confirm a booking to see your seat numbers here.
								</p>
							) : (
								Object.entries(
									groupSeatsByRow(userBookedSeatsQuery.data ?? []),
								)
									.sort(
										([left], [right]) => Number(left) - Number(right),
									)
									.map(([rowNumber, seats]) => (
										<div
											key={rowNumber}
											className='flex items-start justify-between gap-4'
										>
											<span className='text-slate-400'>
												Row: {getRowLabel(Number(rowNumber))}
											</span>
											<span className='font-semibold text-white'>
												{[...seats]
													.sort(
														(left, right) =>
															left.seat_number -
															right.seat_number,
													)
													.map((seat) => seat.seat_number)
													.join(', ')}
											</span>
										</div>
									))
							)}
						</div>
					</div>
				</aside>
			</div>
		</section>
	);
}
