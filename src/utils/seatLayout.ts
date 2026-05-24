import type { Seat } from './types.ts';
import {
	BROKEN_SEAT_MAX,
	BROKEN_SEAT_MIN,
	BROKEN_SEATS_MAX_PER_ROW,
	DISABILITY_SEAT_COUNT,
	VIP_BLOCK_HEIGHT,
	VIP_BLOCK_WIDTH,
	VIP_ROW_END,
	VIP_ROW_START,
	VIP_SEAT_END,
	VIP_SEAT_START,
} from './constants.ts';

export interface SeatPosition {
	row_number: number;
	seat_number: number;
}

function positionKey(position: SeatPosition) {
	return `${position.row_number}:${position.seat_number}`;
}

// Returns a centred inclusive range for a block that fits inside a row or screen.
function getCenteredRange(totalSlots: number, blockSize: number) {
	const size = Math.min(blockSize, totalSlots);
	const start = Math.floor((totalSlots - size) / 2) + 1;

	return {
		start,
		end: start + size - 1,
	};
}

// Resolves VIP row numbers: standard rows 5–8, or a centred middle-back block on smaller screens.
function getVipRowRange(totalRows: number) {
	if (totalRows >= VIP_ROW_END) {
		return { start: VIP_ROW_START, end: VIP_ROW_END };
	}

	if (totalRows >= VIP_ROW_START) {
		return { start: VIP_ROW_START, end: totalRows };
	}

	const preferredStart = 3;

	if (totalRows < preferredStart) {
		return getCenteredRange(totalRows, VIP_BLOCK_HEIGHT);
	}

	const availableStart = preferredStart;
	const availableCount = totalRows - availableStart + 1;
	const blockHeight = Math.min(VIP_BLOCK_HEIGHT, availableCount);
	const centered = getCenteredRange(availableCount, blockHeight);

	return {
		start: availableStart + centered.start - 1,
		end: availableStart + centered.end - 1,
	};
}

// Resolves VIP seat numbers: standard seats 12–15, or a centred 4-seat block when the row is narrow.
function getVipSeatRange(seatsPerRow: number) {
	if (seatsPerRow >= VIP_SEAT_END) {
		return { start: VIP_SEAT_START, end: VIP_SEAT_END };
	}

	return getCenteredRange(seatsPerRow, VIP_BLOCK_WIDTH);
}

// Resolves VIP row/seat ranges for a screen, using standard positions when possible.
export function getVipSeatPositions(
	totalRows: number,
	seatsPerRow: number,
): SeatPosition[] {
	if (totalRows < 1 || seatsPerRow < 1) {
		return [];
	}

	const { start: rowStart, end: rowEnd } = getVipRowRange(totalRows);
	const { start: seatStart, end: seatEnd } = getVipSeatRange(seatsPerRow);
	const positions: SeatPosition[] = [];

	for (let rowNumber = rowStart; rowNumber <= rowEnd; rowNumber += 1) {
		for (let seatNumber = seatStart; seatNumber <= seatEnd; seatNumber += 1) {
			positions.push({ row_number: rowNumber, seat_number: seatNumber });
		}
	}

	return positions;
}

// Places six disability seats as three adjacent pairs across the first two rows.
export function getDisabilitySeatPositions(
	totalRows: number,
	seatsPerRow: number,
): SeatPosition[] {
	if (totalRows < 1 || seatsPerRow < 1) {
		return [];
	}

	const positions: SeatPosition[] = [];
	let pairsPlaced = 0;

	for (
		let rowNumber = 1;
		rowNumber <= Math.min(2, totalRows) && pairsPlaced < 3;
		rowNumber += 1
	) {
		for (
			let seatNumber = 1;
			seatNumber < seatsPerRow && pairsPlaced < 3;
			seatNumber += 2
		) {
			if (seatNumber + 1 > seatsPerRow) {
				break;
			}

			positions.push({ row_number: rowNumber, seat_number: seatNumber });
			positions.push({
				row_number: rowNumber,
				seat_number: seatNumber + 1,
			});
			pairsPlaced += 1;
		}
	}

	return positions.slice(0, DISABILITY_SEAT_COUNT);
}

export function isVipPosition(
	rowNumber: number,
	seatNumber: number,
	totalRows: number,
	seatsPerRow: number,
) {
	const vipKeys = new Set(
		getVipSeatPositions(totalRows, seatsPerRow).map(positionKey),
	);

	return vipKeys.has(positionKey({ row_number: rowNumber, seat_number: seatNumber }));
}

export function isDisabilityPosition(
	rowNumber: number,
	seatNumber: number,
	totalRows: number,
	seatsPerRow: number,
) {
	const disabilityKeys = new Set(
		getDisabilitySeatPositions(totalRows, seatsPerRow).map(positionKey),
	);

	return disabilityKeys.has(
		positionKey({ row_number: rowNumber, seat_number: seatNumber }),
	);
}

// Ensures the screen can host the required disability seating block.
export function validateDisabilityLayout(totalRows: number, seatsPerRow: number) {
	const frontRowCapacity = Math.min(2, totalRows) * seatsPerRow;

	if (getDisabilitySeatPositions(totalRows, seatsPerRow).length < DISABILITY_SEAT_COUNT) {
		throw new Error(
			`Screen must fit at least ${DISABILITY_SEAT_COUNT} disability seats in the first two rows.`,
		);
	}

	if (frontRowCapacity < DISABILITY_SEAT_COUNT) {
		throw new Error(
			`The first two rows need at least ${DISABILITY_SEAT_COUNT} seats for accessibility seating.`,
		);
	}
}

function areAdjacentInRow(left: Seat, right: Seat) {
	return (
		left.row_number === right.row_number &&
		Math.abs(left.seat_number - right.seat_number) === 1
	);
}

function canAddBrokenSeat(
	candidate: Seat,
	selected: Seat[],
	rowCounts: Map<number, number>,
) {
	const rowCount = rowCounts.get(candidate.row_number) ?? 0;

	if (rowCount >= BROKEN_SEATS_MAX_PER_ROW) {
		return false;
	}

	return !selected.some((seat) => areAdjacentInRow(seat, candidate));
}

// Randomly picks broken seats for a showtime while respecting row and adjacency limits.
export function generateBrokenSeatIds(
	seats: Seat[],
	random: () => number = Math.random,
): number[] {
	const eligibleSeats = seats.filter((seat) => seat.seat_type === 'regular');

	if (eligibleSeats.length === 0) {
		return [];
	}

	const targetCount = Math.min(
		eligibleSeats.length,
		BROKEN_SEAT_MIN +
			Math.floor(random() * (BROKEN_SEAT_MAX - BROKEN_SEAT_MIN + 1)),
	);
	const shuffled = [...eligibleSeats].sort(() => random() - 0.5);
	const selected: Seat[] = [];
	const rowCounts = new Map<number, number>();

	for (const candidate of shuffled) {
		if (selected.length >= targetCount) {
			break;
		}

		if (!canAddBrokenSeat(candidate, selected, rowCounts)) {
			continue;
		}

		selected.push(candidate);
		rowCounts.set(
			candidate.row_number,
			(rowCounts.get(candidate.row_number) ?? 0) + 1,
		);
	}

	if (selected.length < BROKEN_SEAT_MIN) {
		for (const candidate of shuffled) {
			if (selected.length >= BROKEN_SEAT_MIN) {
				break;
			}

			if (selected.some((seat) => seat.id === candidate.id)) {
				continue;
			}

			if (!canAddBrokenSeat(candidate, selected, rowCounts)) {
				continue;
			}

			selected.push(candidate);
			rowCounts.set(
				candidate.row_number,
				(rowCounts.get(candidate.row_number) ?? 0) + 1,
			);
		}
	}

	return selected.map((seat) => seat.id);
}
