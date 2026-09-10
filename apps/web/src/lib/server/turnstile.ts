const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token (spec §3: registration and logged-in POST /api/runs).
 * Cloudflare and OAuth are the only external calls allowed from the Worker (spec §13).
 */
export async function verifyTurnstile(
	secret: string,
	token: string,
	remoteIp?: string,
	fetchImpl: typeof fetch = fetch
): Promise<boolean> {
	const body = new URLSearchParams({ secret, response: token });
	if (remoteIp) body.set('remoteip', remoteIp);
	try {
		const res = await fetchImpl(SITEVERIFY, { method: 'POST', body });
		if (!res.ok) return false;
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}
