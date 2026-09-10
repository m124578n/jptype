/**
 * Invisible Turnstile (spec §3): fetch a token right before POST /api/runs for logged-in users.
 * Loads Cloudflare's script on first use; resolves undefined when no site key is configured.
 */
declare global {
	interface Window {
		turnstile?: {
			render(
				el: HTMLElement,
				opts: {
					sitekey: string;
					size?: 'invisible' | 'normal' | 'compact' | 'flexible';
					execution?: 'render' | 'execute';
					callback: (token: string) => void;
					'error-callback'?: () => void;
					'expired-callback'?: () => void;
				}
			): string;
			execute(widgetId: string): void;
			remove(widgetId: string): void;
		};
	}
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
	if (window.turnstile) return Promise.resolve();
	if (!loading) {
		loading = new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = SCRIPT;
			s.async = true;
			s.onload = () => resolve();
			s.onerror = () => reject(new Error('turnstile script failed'));
			document.head.appendChild(s);
		});
	}
	return loading;
}

export async function getTurnstileToken(siteKey: string): Promise<string | undefined> {
	if (!siteKey || typeof window === 'undefined') return undefined;
	try {
		await loadScript();
	} catch {
		return undefined;
	}
	const ts = window.turnstile;
	if (!ts) return undefined;
	const host = document.createElement('div');
	host.style.position = 'fixed';
	host.style.inset = '0 auto auto 0';
	host.style.width = '0';
	host.style.height = '0';
	document.body.appendChild(host);
	return new Promise<string | undefined>((resolve) => {
		let id = '';
		const done = (token?: string) => {
			try {
				if (id) ts.remove(id);
			} catch {
				// widget already gone
			}
			host.remove();
			resolve(token);
		};
		try {
			id = ts.render(host, {
				sitekey: siteKey,
				size: 'invisible',
				execution: 'execute',
				callback: (token) => done(token),
				'error-callback': () => done(undefined),
				'expired-callback': () => done(undefined)
			});
			ts.execute(id);
		} catch {
			done(undefined);
		}
	});
}
