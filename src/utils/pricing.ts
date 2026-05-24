import type { Seat } from './types.ts';

// Computes one seat ticket price from showtime base price and seat multiplier.
export function getSeatTicketPrice(seat: Seat, basePrice: number) {
	return basePrice * seat.price_multiplier;
}

// Sums ticket prices for a set of seats on one showtime.
export function calculateBookingTotal(
	seatIds: number[],
	seats: Seat[],
	basePrice: number,
) {
	const seatsById = new Map(seats.map((seat) => [seat.id, seat]));

	return seatIds.reduce((total, seatId) => {
		const seat = seatsById.get(seatId);
		return total + (seat ? getSeatTicketPrice(seat, basePrice) : 0);
	}, 0);
}
