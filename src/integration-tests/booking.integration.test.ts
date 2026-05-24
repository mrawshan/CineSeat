import { describe, expect, it, vi } from 'vitest';
import {
	confirmBooking,
	releaseSeatLocks,
	syncSeatLocks,
} from '../services/bookingService';

/**
 * Integration tests: seat lock -> booking -> booking seat -> seat lock release
 */

const brokenSeatIds = [99];
const seats = [
	{
		id: 1,
		screen_id: 1,
		row_number: 5,
		seat_number: 12,
		seat_type: 'vip',
		price_multiplier: 1.5,
	},
	{
		id: 2,
		screen_id: 1,
		row_number: 1,
		seat_number: 1,
		seat_type: 'regular',
		price_multiplier: 1,
	},
];

vi.mock('../services/supabase.ts', () => {
	type QueryResult = { data: unknown; error: unknown };
	type Builder = {
		select: (columns?: string) => Builder;
		eq: (key: string, value: unknown) => Builder;
		gt: (key: string, value: unknown) => Builder;
		in: (key: string, values: unknown[]) => Builder;
		lte: (key: string, value: unknown) => Builder;
		order: (key: string, options?: { ascending?: boolean }) => Builder;
		limit: (n: number) => Builder;
		insert: (payload: unknown) => Builder;
		delete: () => Builder;
		single: () => Promise<QueryResult>;
		maybeSingle: () => Promise<QueryResult>;
		then: (
			resolve: (value: QueryResult) => unknown,
			reject: (reason: unknown) => unknown,
		) => void;
	};

	function createBuilder(table: string): Builder {
		let op: 'select' | 'insert' | 'delete' = 'select';
		let insertPayload: unknown = null;

		const builder: Builder = {
			select: () => builder,
			eq: () => builder,
			gt: () => builder,
			in: () => builder,
			lte: () => builder,
			order: () => builder,
			limit: () => builder,
			insert: (payload: unknown) => {
				op = 'insert';
				insertPayload = payload;
				return builder;
			},
			delete: () => {
				op = 'delete';
				return builder;
			},
			single: async () => {
				if (op === 'insert' && table === 'bookings') {
					return {
						data: {
							id: 1,
							showtime_id: 1,
							user_id: 'user-1',
							status: 'confirmed',
							total_price: Number(
								(insertPayload as Record<string, unknown>)
									.total_price ?? 0,
							),
							admin_override_used: Boolean(
								(insertPayload as Record<string, unknown>)
									.admin_override_used,
							),
							created_at: new Date().toISOString(),
						},
						error: null,
					};
				}

				if (table === 'showtimes') {
					return {
						data: {
							screen_id: 1,
							base_price: 10,
						},
						error: null,
					};
				}

				return { data: null, error: null };
			},
			maybeSingle: async () => ({ data: null, error: null }),
			then: (resolve, reject) => {
				(async () => {
					if (op === 'delete') {
						return { data: null, error: null };
					}

					if (op === 'select') {
						if (table === 'showtime_broken_seats') {
							return {
								data: brokenSeatIds.map((seatId) => ({
									seat_id: seatId,
								})),
								error: null,
							};
						}

						if (table === 'seats') {
							return { data: seats, error: null };
						}

						return { data: [], error: null };
					}

					if (op === 'insert') {
						if (table === 'seat_locks' || table === 'booking_seats') {
							return { data: [], error: null };
						}
					}

					return { data: null, error: null };
				})()
					.then(resolve)
					.catch(reject);
			},
		};

		return builder;
	}

	return {
		default: {
			from: vi.fn((table: string) => createBuilder(table)),
		},
	};
});

describe('Booking Integration Tests', () => {
	it('should block broken seats for normal users', async () => {
		await expect(
			syncSeatLocks({
				showtimeId: 1,
				seatIds: [99],
				userId: 'user-1',
			}),
		).rejects.toThrow('One or more selected seats are no longer available.');
	});

	it('should allow broken seats when admin override is enabled', async () => {
		await expect(
			syncSeatLocks({
				showtimeId: 1,
				seatIds: [99],
				userId: 'user-1',
				adminOverride: true,
			}),
		).resolves.toEqual([]);
	});

	it('should confirm booking with VIP pricing', async () => {
		const result = await confirmBooking({
			showtimeId: 1,
			seatIds: [1, 2],
			userId: 'user-1',
		});

		expect(result.booking.total_price).toBe(25);
	});

	it('should release seat locks successfully', async () => {
		await expect(
			releaseSeatLocks({
				showtimeId: 1,
				userId: 'user-1',
			}),
		).resolves.toBeUndefined();
	});
});
