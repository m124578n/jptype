export function formatKpm(kpm: number): string {
	return Math.round(kpm).toString();
}

export function formatAccuracy(accuracy: number): string {
	return `${Math.round(accuracy * 100)}%`;
}

const DATE_TIME = new Intl.DateTimeFormat('zh-TW', {
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'Asia/Taipei'
});

/** Epoch ms as a Taipei-time stamp, for admin tables and notices. */
export function formatDateTime(epochMs: number): string {
	return DATE_TIME.format(new Date(epochMs));
}
