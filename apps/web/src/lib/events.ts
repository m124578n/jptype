/**
 * Browser side of the content analytics (M4-4): fire-and-forget counters. `sendBeacon` so a
 * `complete` sent while the user is already navigating away still lands; a failure is
 * silently dropped — a counter must never get in the way of practising.
 */
import type { EventKind } from './server/events/store.ts';

export type { EventKind };

export function trackContentEvent(contentId: string, kind: EventKind): void {
	const body = JSON.stringify({ contentId, kind });
	try {
		if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
			const blob = new Blob([body], { type: 'application/json' });
			if (navigator.sendBeacon('/api/events', blob)) return;
		}
		void fetch('/api/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
			keepalive: true
		}).catch(() => undefined);
	} catch {
		// offline / blocked: nothing to do
	}
}
