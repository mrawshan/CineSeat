import { describe, expect, it } from 'vitest';
import { findBestSeats } from './seatAllocator';
import type { Seat } from './types';

const seats: Seat[] = [
	{
		id: 1,
		screen_id: 1,
		row_number: 1,
		seat_number: 1,
		seat_type: 'disability',
		price_multiplier: 1,
	},
	{
		id: 2,
		screen_id: 1,
		row_number: 1,
		seat_number: 2,
		seat_type: 'disability',
		price_multiplier: 1,
	},
	{
		id: 3,
		screen_id: 1,
		row_number: 1,
		seat_number: 3,
		seat_type: 'disability',
		price_multiplier: 1,
	},
	{
		id: 4,
		screen_id: 1,
		row_number: 1,
		seat_number: 4,
		seat_type: 'regular',
		price_multiplier: 1,
	},
	{
		id: 5,
		screen_id: 1,
		row_number: 2,
		seat_number: 1,
		seat_type: 'regular',
		price_multiplier: 1,
	},
	{
		id: 6,
		screen_id: 1,
		row_number: 2,
		seat_number: 2,
		seat_type: 'regular',
		price_multiplier: 1,
	},
	{
		id: 7,
		screen_id: 1,
		row_number: 2,
		seat_number: 3,
		seat_type: 'regular',
		price_multiplier: 1,
	},
	{
		id: 8,
		screen_id: 1,
		row_number: 3,
		seat_number: 1,
		seat_type: 'regular',
		price_multiplier: 1,
	},
	{
		id: 9,
		screen_id: 1,
		row_number: 3,
		seat_number: 2,
		seat_type: 'regular',
		price_multiplier: 1,
	},
	{
		id: 10,
		screen_id: 1,
		row_number: 3,
		seat_number: 3,
		seat_type: 'regular',
		price_multiplier: 1,
	},
];

describe('findBestSeats', () => {
	it('should allocate adjacent seats for a group', () => {
		const result = findBestSeats(seats, [], {
			groupSize: 3,
		});

		expect(result.seatIds).toEqual([8, 9, 10]);
		expect(result.isAdjacent).toBe(true);
		expect(result.usedFallback).toBe(false);
	});

	it('should ignore unavailable and broken seats', () => {
		const result = findBestSeats(seats, [1, 2, 3, 5, 6], {
			groupSize: 2,
		});

		expect(result.seatIds).toEqual([8, 9]);
	});

	it('should prefer back rows over front rows', () => {
		const result = findBestSeats(seats, [1, 2, 3, 4], {
			groupSize: 2,
		});

		expect(result.seatIds).toEqual([8, 9]);
	});

	it('should use fallback when adjacent seats are unavailable', () => {
		const result = findBestSeats(seats, [2, 3, 4, 5, 6, 7, 8], {
			groupSize: 3,
		});

		expect(result.usedFallback).toBe(true);
		expect(result.seatIds).toEqual([9, 10, 1]);
	});

	it('should return empty result when seats are insufficient', () => {
		const result = findBestSeats(seats, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
			groupSize: 3,
		});

		expect(result.seatIds).toEqual([]);
	});

	it('should reject group sizes outside the supported range', () => {
		expect(
			findBestSeats(seats, [], {
				groupSize: 1,
			}).seatIds,
		).toEqual([]);
		expect(
			findBestSeats(seats, [], {
				groupSize: 8,
			}).seatIds,
		).toEqual([]);
	});
});
