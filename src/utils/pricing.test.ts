import { describe, expect, it } from 'vitest';
import { calculateBookingTotal } from './pricing';
import type { Seat } from './types';

describe('pricing', () => {
	it('calculates booking totals from base price and seat multipliers', () => {
		const seats: Seat[] = [
			{
				id: 1,
				screen_id: 1,
				row_number: 5,
				seat_number: 12,
				seat_type: 'vip',
				price_multiplier: 2,
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

		expect(calculateBookingTotal([1, 2], seats, 10)).toBe(30);
	});
});
