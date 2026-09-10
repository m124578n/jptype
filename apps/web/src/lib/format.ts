export function formatKpm(kpm: number): string {
	return Math.round(kpm).toString();
}

export function formatAccuracy(accuracy: number): string {
	return `${Math.round(accuracy * 100)}%`;
}
