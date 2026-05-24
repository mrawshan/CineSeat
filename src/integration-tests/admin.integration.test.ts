import { describe, expect, it, vi } from 'vitest';
import {
	createMovie,
	createScreen,
	createShowtime,
	deleteMovie,
	updateMovie,
} from '../services/adminService';
import supabase from '../services/supabase.ts';

/**
 * Integration tests admin CRUD operations: movie -> screen -> showtime
 */

const { insertedSeats, insertedBrokenSeats } = vi.hoisted(() => ({
	insertedSeats: [] as Array<Record<string, unknown>>,
	insertedBrokenSeats: [] as Array<Record<string, unknown>>,
}));

vi.mock('../services/supabase.ts', () => {
	type QueryResult = { data: unknown; error: unknown };
	type Builder = {
		select: (columns?: string) => Builder;
		insert: (payload: unknown) => Builder;
		update: (payload: unknown) => Builder;
		delete: () => Builder;
		eq: (key: string, value: unknown) => Builder;
		order: (key: string, options?: { ascending?: boolean }) => Builder;
		limit: (n: number) => Builder;
		single: () => Promise<QueryResult>;
		then: (
			resolve: (value: QueryResult) => unknown,
			reject: (reason: unknown) => unknown,
		) => void;
	};

	function createBuilder(table: string): Builder {
		let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
		let payload: unknown = null;

		const builder: Builder = {
			select: () => builder,
			insert: (next: unknown) => {
				op = 'insert';
				payload = next;
				return builder;
			},
			update: (next: unknown) => {
				op = 'update';
				payload = next;
				return builder;
			},
			delete: () => {
				op = 'delete';
				return builder;
			},
			eq: () => builder,
			order: () => builder,
			limit: () => builder,
			single: async () => {
				const createdAt = new Date().toISOString();

				if (op === 'insert' && table === 'movies') {
					const record = payload as Record<string, unknown>;
					return {
						data: {
							id: 1,
							title: String(record.title ?? ''),
							duration: Number(record.duration ?? 0),
							description: record.description
								? String(record.description)
								: null,
							created_at: createdAt,
						},
						error: null,
					};
				}

				if (op === 'insert' && table === 'screens') {
					const record = payload as Record<string, unknown>;
					return {
						data: {
							id: 1,
							name: String(record.name ?? ''),
							total_rows: Number(record.total_rows ?? 0),
							seats_per_row: Number(record.seats_per_row ?? 0),
							created_at: createdAt,
						},
						error: null,
					};
				}

				if (op === 'insert' && table === 'showtimes') {
					const record = payload as Record<string, unknown>;
					return {
						data: {
							id: 10,
							screen_id: Number(record.screen_id ?? 1),
						},
						error: null,
					};
				}

				return { data: { id: 1 }, error: null };
			},
			then: (resolve, reject) => {
				(async () => {
					if (op === 'delete') return { data: null, error: null };
					if (op === 'update') return { data: { id: 1 }, error: null };

					if (op === 'select' && table === 'seats') {
						return {
							data: insertedSeats.map((seat, index) => ({
								id: index + 1,
								...seat,
							})),
							error: null,
						};
					}

					if (op === 'insert' && table === 'seats') {
						const records = Array.isArray(payload) ? payload : [payload];
						insertedSeats.push(
							...(records as Array<Record<string, unknown>>),
						);
						return { data: [], error: null };
					}

					if (op === 'insert' && table === 'showtime_broken_seats') {
						const records = Array.isArray(payload) ? payload : [payload];
						insertedBrokenSeats.push(
							...(records as Array<Record<string, unknown>>),
						);
						return { data: [], error: null };
					}

					return { data: [], error: null };
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

describe('Admin Integration Tests', () => {
	it('should create a movie successfully', async () => {
		await expect(
			createMovie({
				title: 'Avengers',
				description: 'Marvel movie',
				duration: 180,
			}),
		).resolves.toBeUndefined();
	});

	it('should update a movie successfully', async () => {
		await expect(
			updateMovie(1, {
				title: 'Updated Avengers',
				description: 'Updated description',
				duration: 190,
			}),
		).resolves.toBeUndefined();
	});

	it('should delete a movie successfully', async () => {
		await expect(deleteMovie(1)).resolves.toBeUndefined();
	});

	it('should create a screen with VIP and disability seat types', async () => {
		insertedSeats.length = 0;

		await expect(
			createScreen({
				name: 'Screen 1',
				total_rows: 8,
				seats_per_row: 16,
			}),
		).resolves.toBeDefined();

		expect(insertedSeats.some((seat) => seat.seat_type === 'vip')).toBe(true);
		expect(
			insertedSeats.some((seat) => seat.seat_type === 'disability'),
		).toBe(true);
		expect(
			insertedSeats.filter((seat) => seat.seat_type === 'disability'),
		).toHaveLength(6);
	});

	it('should create a showtime and generate broken seats', async () => {
		insertedBrokenSeats.length = 0;
		insertedSeats.length = 0;

		for (let rowNumber = 1; rowNumber <= 8; rowNumber += 1) {
			for (let seatNumber = 1; seatNumber <= 16; seatNumber += 1) {
				insertedSeats.push({
					screen_id: 1,
					row_number: rowNumber,
					seat_number: seatNumber,
					seat_type: 'regular',
					price_multiplier: 1,
				});
			}
		}

		await expect(
			createShowtime({
				movie_id: 1,
				screen_id: 1,
				start_time: new Date().toISOString(),
				base_price: 12,
			}),
		).resolves.toBeUndefined();

		expect(insertedBrokenSeats.length).toBeGreaterThanOrEqual(6);
		expect(insertedBrokenSeats.length).toBeLessThanOrEqual(10);
	});

	it('should call Supabase database methods', async () => {
		const fromMock = vi.mocked(supabase.from);

		await createMovie({
			title: 'Test Movie',
			description: 'Testing',
			duration: 120,
		});

		expect(fromMock).toHaveBeenCalled();
	});
});
