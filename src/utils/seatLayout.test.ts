import { describe, expect, it } from 'vitest';
import {
	generateBrokenSeatIds,
	getDisabilitySeatPositions,
	getVipSeatPositions,
} from './seatLayout';
import type { Seat } from './types';

function buildSeats(
	totalRows: number,
	seatsPerRow: number,
	seatTypeByPosition?: (row: number, seat: number) => Seat['seat_type'],
): Seat[] {
	const seats: Seat[] = [];
	let id = 1;

	for (let rowNumber = 1; rowNumber <= totalRows; rowNumber += 1) {
		for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber += 1) {
			seats.push({
				id,
				screen_id: 1,
				row_number: rowNumber,
				seat_number: seatNumber,
				seat_type: seatTypeByPosition?.(rowNumber, seatNumber) ?? 'regular',
				price_multiplier: 1,
			});
			id += 1;
		}
	}

	return seats;
}

function seatNumbersInRow(
	positions: ReturnType<typeof getVipSeatPositions>,
	row: number,
) {
	return positions
		.filter((position) => position.row_number === row)
		.map((position) => position.seat_number)
		.sort((left, right) => left - right);
}

describe('seat layout rules', () => {
	it('marks VIP seats in the middle rows and seat range', () => {
		const vipPositions = getVipSeatPositions(8, 16);

		expect(vipPositions).toContainEqual({ row_number: 5, seat_number: 12 });
		expect(vipPositions).toContainEqual({ row_number: 8, seat_number: 15 });
		expect(vipPositions).not.toContainEqual({
			row_number: 4,
			seat_number: 12,
		});
	});

	it('uses a centred VIP seat block when seats per row are below 15', () => {
		const vipPositions = getVipSeatPositions(8, 10);

		expect(seatNumbersInRow(vipPositions, 5)).toEqual([4, 5, 6, 7]);
		expect(vipPositions).not.toContainEqual({
			row_number: 5,
			seat_number: 10,
		});
	});

	it('uses a centred middle-back VIP row block when total rows are below 8', () => {
		const vipPositions = getVipSeatPositions(4, 10);

		expect(vipPositions.every((position) => position.row_number >= 3)).toBe(
			true,
		);
		expect(seatNumbersInRow(vipPositions, 3)).toEqual([4, 5, 6, 7]);
		expect(seatNumbersInRow(vipPositions, 4)).toEqual([4, 5, 6, 7]);
	});

	it('creates six disability seats as adjacent pairs in front rows', () => {
		const disabilityPositions = getDisabilitySeatPositions(8, 12);

		expect(disabilityPositions).toHaveLength(6);
		expect(
			disabilityPositions.every((position) => position.row_number <= 2),
		).toBe(true);
	});

	it('generates broken seats within count and adjacency constraints', () => {
		const seats = buildSeats(8, 12);
		const brokenSeatIds = generateBrokenSeatIds(seats, () => 0.42);
		const brokenSeats = seats.filter((seat) =>
			brokenSeatIds.includes(seat.id),
		);

		expect(brokenSeatIds.length).toBeGreaterThanOrEqual(6);
		expect(brokenSeatIds.length).toBeLessThanOrEqual(10);

		const rowCounts = new Map<number, number>();

		for (const seat of brokenSeats) {
			rowCounts.set(
				seat.row_number,
				(rowCounts.get(seat.row_number) ?? 0) + 1,
			);
		}

		expect([...rowCounts.values()].every((count) => count <= 2)).toBe(true);

		for (const seat of brokenSeats) {
			const hasAdjacentBroken = brokenSeats.some(
				(other) =>
					other.id !== seat.id &&
					other.row_number === seat.row_number &&
					Math.abs(other.seat_number - seat.seat_number) === 1,
			);

			expect(hasAdjacentBroken).toBe(false);
		}
	});

	it('prefers regular seats for broken seat generation', () => {
		const vipPositions = new Set(
			getVipSeatPositions(8, 16).map(
				(position) => `${position.row_number}:${position.seat_number}`,
			),
		);
		const disabilityPositions = new Set(
			getDisabilitySeatPositions(8, 16).map(
				(position) => `${position.row_number}:${position.seat_number}`,
			),
		);
		const seats = buildSeats(8, 16, (rowNumber, seatNumber) => {
			const key = `${rowNumber}:${seatNumber}`;

			if (disabilityPositions.has(key)) {
				return 'disability';
			}

			if (vipPositions.has(key)) {
				return 'vip';
			}

			return 'regular';
		});

		const brokenSeatIds = generateBrokenSeatIds(seats, () => 0.1);
		const brokenSeats = seats.filter((seat) =>
			brokenSeatIds.includes(seat.id),
		);

		expect(brokenSeats.every((seat) => seat.seat_type === 'regular')).toBe(
			true,
		);
		expect(brokenSeats.some((seat) => seat.seat_type === 'vip')).toBe(false);
		expect(brokenSeats.some((seat) => seat.seat_type === 'disability')).toBe(
			false,
		);
	});
});
