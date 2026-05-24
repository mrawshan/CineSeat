// Returns the local date in YYYY-MM-DD format for native date inputs.
export function getTodayDateValue() {
	return new Date().toLocaleDateString('en-CA');
}

// Returns the start and end date range for a given date value
export function getDateRange(dateValue: string) {
	const start = new Date(`${dateValue}T00:00:00`);
	const end = new Date(`${dateValue}T23:59:59.999`);

	return {
		start: start.toISOString(),
		end: end.toISOString(),
	};
}

// Returns the date label for a given date value
export function formatDateLabel(dateValue: string) {
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date(`${dateValue}T00:00:00`));
}

// Returns the time label for a given value
export function formatTimeLabel(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(value));
}

// Returns true when the screening is over (start + duration). If duration is missing, uses start time only.
export function isShowtimeScreeningEnded(
	startTimeIso: string,
	durationMinutes: number | null | undefined,
): boolean {
	const startMs = new Date(startTimeIso).getTime();
	if (!Number.isFinite(startMs)) {
		return false;
	}

	const now = Date.now();
	const hasDuration =
		typeof durationMinutes === 'number' &&
		Number.isFinite(durationMinutes) &&
		durationMinutes > 0;

	if (hasDuration) {
		return now > startMs + durationMinutes * 60 * 1000;
	}

	return now > startMs;
}

// Returns the date time label for a given value
export function formatDateTimeLabel(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(value));
}

// Converts an ISO timestamp into the value format used by datetime-local inputs.
export function toDateTimeLocalValue(value: string) {
	const date = new Date(value);
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	const hours = `${date.getHours()}`.padStart(2, '0');
	const minutes = `${date.getMinutes()}`.padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Returns the currency label for a given amount
export function formatCurrency(amount: number) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

// Returns the duration label for a given duration in minutes
export function formatDuration(durationMinutes: number) {
	const hours = Math.floor(durationMinutes / 60);
	const minutes = durationMinutes % 60;

	if (hours === 0) {
		return `${minutes} min`;
	}

	if (minutes === 0) {
		return `${hours} hr`;
	}

	return `${hours} hr ${minutes} min`;
}

// Returns the countdown label for a given total seconds
export function formatCountdown(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Returns the remaining seconds for a given locked until date
export function getRemainingSeconds(lockedUntil: string) {
	return Math.max(
		0,
		Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000),
	);
}

// Returns the row label for a given row number
export function getRowLabel(rowNumber: number) {
	if (rowNumber >= 1 && rowNumber <= 26) {
		return String.fromCharCode(64 + rowNumber);
	}

	return `R${rowNumber}`;
}
