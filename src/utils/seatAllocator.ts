import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from './constants.ts';
import type { Seat } from './types.ts';

export interface SeatAllocatorOptions {
	groupSize: number;
	preferAdjacent?: boolean;
}

export interface SeatAllocatorResult {
	seatIds: number[];
	isAdjacent: boolean;
	usedFallback: boolean;
}

interface SeatBlock {
	seats: Seat[];
	isAdjacent: boolean;
	score: number;
}

// Returns true when every seat in the list has consecutive seat numbers in the same row.
function areSeatNumbersAdjacent(seats: Seat[]) {
	return seats.every((seat, index, allSeats) => {
		if (index === 0) {
			return true;
		}

		return seat.seat_number === allSeats[index - 1].seat_number + 1;
	});
}

// Counts empty seats in a row that would be isolated on both sides after a selection.
function countOrphanSingles(
	rowSeats: Seat[],
	selectedSeatIds: Set<number>,
	unavailableSeatIds: Set<number>,
) {
	let orphans = 0;

	for (let index = 0; index < rowSeats.length; index += 1) {
		const seat = rowSeats[index];
		const isUnavailable =
			unavailableSeatIds.has(seat.id) || selectedSeatIds.has(seat.id);

		if (isUnavailable) {
			continue;
		}

		const leftUnavailable =
			index === 0 ||
			unavailableSeatIds.has(rowSeats[index - 1].id) ||
			selectedSeatIds.has(rowSeats[index - 1].id);
		const rightUnavailable =
			index === rowSeats.length - 1 ||
			unavailableSeatIds.has(rowSeats[index + 1].id) ||
			selectedSeatIds.has(rowSeats[index + 1].id);

		if (leftUnavailable && rightUnavailable) {
			orphans += 1;
		}
	}

	return orphans;
}

// Ranks a candidate block higher for back rows, fewer orphan singles, and non-VIP seats.
function scoreSeatBlock(
	block: Seat[],
	rowSeats: Seat[],
	unavailableSeatIds: Set<number>,
	totalRows: number,
) {
	const rowNumber = block[0]?.row_number ?? 1;
	const middleRow = Math.ceil(totalRows / 2);
	let score = rowNumber * 10;

	if (rowNumber >= middleRow) {
		score += 25;
	}

	const selectedSeatIds = new Set(block.map((seat) => seat.id));
	score -=
		countOrphanSingles(rowSeats, selectedSeatIds, unavailableSeatIds) * 12;

	if (block.some((seat) => seat.seat_type === 'vip')) {
		score -= 5;
	}

	return score;
}

// Lists every adjacent group of seats that fit in one row for the requested group size.
function buildRowBlocks(
	rowSeats: Seat[],
	groupSize: number,
	unavailableSeatIds: Set<number>,
	totalRows: number,
): SeatBlock[] {
	const blocks: SeatBlock[] = [];

	for (let index = 0; index <= rowSeats.length - groupSize; index += 1) {
		const candidate = rowSeats.slice(index, index + groupSize);
		const isAdjacent = areSeatNumbersAdjacent(candidate);

		if (!isAdjacent) {
			continue;
		}

		blocks.push({
			seats: candidate,
			isAdjacent: true,
			score: scoreSeatBlock(
				candidate,
				rowSeats,
				unavailableSeatIds,
				totalRows,
			),
		});
	}

	return blocks;
}

// Builds one group spanning two consecutive rows when the group is wider than a single row.
function buildMultiRowBlock(
	availableSeats: Seat[],
	groupSize: number,
	unavailableSeatIds: Set<number>,
	totalRows: number,
): SeatBlock | null {
	const rowBuckets = new Map<number, Seat[]>();

	for (const seat of availableSeats) {
		const rowSeats = rowBuckets.get(seat.row_number) ?? [];
		rowSeats.push(seat);
		rowBuckets.set(seat.row_number, rowSeats);
	}

	const rowNumbers = [...rowBuckets.keys()].sort(
		(left, right) => right - left,
	);

	for (const rowNumber of rowNumbers) {
		const rowSeats = rowBuckets.get(rowNumber) ?? [];
		const remaining = groupSize - rowSeats.length;

		if (remaining <= 0) {
			continue;
		}

		const nextRowSeats = rowBuckets.get(rowNumber + 1) ?? [];

		if (nextRowSeats.length < remaining) {
			continue;
		}

		const block = [...rowSeats, ...nextRowSeats.slice(0, remaining)];

		return {
			seats: block,
			isAdjacent: false,
			score: scoreSeatBlock(block, rowSeats, unavailableSeatIds, totalRows),
		};
	}

	return null;
}

// Returns the highest-scoring seat block from a list of candidates.
function pickBestBlock(blocks: SeatBlock[]) {
	if (blocks.length === 0) {
		return null;
	}

	return [...blocks].sort((left, right) => right.score - left.score)[0];
}

// Picks the best available seats for a group, keeping them together when possible.
export function findBestSeats(
	seats: Seat[],
	unavailableSeatIds: number[],
	options: SeatAllocatorOptions,
): SeatAllocatorResult {
	const { groupSize, preferAdjacent = true } = options;

	if (groupSize < MIN_GROUP_SIZE || groupSize > MAX_GROUP_SIZE) {
		return {
			seatIds: [],
			isAdjacent: false,
			usedFallback: false,
		};
	}

	const unavailable = new Set(unavailableSeatIds);
	const availableSeats = [...seats]
		.filter((seat) => !unavailable.has(seat.id))
		.sort((left, right) => {
			if (left.row_number !== right.row_number) {
				return left.row_number - right.row_number;
			}

			return left.seat_number - right.seat_number;
		});

	if (availableSeats.length < groupSize) {
		return {
			seatIds: [],
			isAdjacent: false,
			usedFallback: false,
		};
	}

	const totalRows = Math.max(...seats.map((seat) => seat.row_number), 1);
	const rowBuckets = new Map<number, Seat[]>();

	for (const seat of availableSeats) {
		const rowSeats = rowBuckets.get(seat.row_number) ?? [];
		rowSeats.push(seat);
		rowBuckets.set(seat.row_number, rowSeats);
	}

	if (preferAdjacent) {
		const blocks = [...rowBuckets.entries()]
			.sort(([left], [right]) => right - left)
			.flatMap(([, rowSeats]) =>
				buildRowBlocks(rowSeats, groupSize, unavailable, totalRows),
			);
		const bestAdjacent = pickBestBlock(blocks);

		if (bestAdjacent) {
			return {
				seatIds: bestAdjacent.seats.map((seat) => seat.id),
				isAdjacent: true,
				usedFallback: false,
			};
		}

		const maxRowSize = Math.max(
			...[...rowBuckets.values()].map((rowSeats) => rowSeats.length),
			0,
		);

		if (groupSize > maxRowSize) {
			const multiRowBlock = buildMultiRowBlock(
				availableSeats,
				groupSize,
				unavailable,
				totalRows,
			);

			if (multiRowBlock) {
				return {
					seatIds: multiRowBlock.seats.map((seat) => seat.id),
					isAdjacent: false,
					usedFallback: true,
				};
			}
		}
	}

	const fallbackSeats = [...availableSeats]
		.sort((left, right) => {
			if (left.row_number !== right.row_number) {
				return right.row_number - left.row_number;
			}

			return left.seat_number - right.seat_number;
		})
		.slice(0, groupSize);

	return {
		seatIds: fallbackSeats.map((seat) => seat.id),
		isAdjacent: areSeatNumbersAdjacent(fallbackSeats),
		usedFallback: true,
	};
}
