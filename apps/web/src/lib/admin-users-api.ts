/**
 * Browser side of the admin user / run API (M4-4). Every call resolves to a boolean instead of
 * throwing, like `songs-api.ts`: the page shows "failed" and keeps its state for a retry.
 */
async function call(url: string, init: RequestInit): Promise<boolean> {
	try {
		const res = await fetch(url, init);
		return res.ok;
	} catch {
		return false;
	}
}

function postJson(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	};
}

export function setRunFlag(runId: string, flagged: boolean): Promise<boolean> {
	return call(`/api/admin/runs/${encodeURIComponent(runId)}`, postJson({ flagged }));
}

export function deleteRun(runId: string): Promise<boolean> {
	return call(`/api/admin/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
}

export function reinstateUser(userId: string): Promise<boolean> {
	return call(`/api/admin/users/${encodeURIComponent(userId)}/reinstate`, postJson({}));
}
