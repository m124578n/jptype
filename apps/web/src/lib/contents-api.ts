/**
 * Browser side of the content API (M4-1) — the admin console's only fetch layer.
 *
 * Every call resolves instead of throwing: a failed save must leave the Line Editor's state
 * alone so the admin can retry without losing the import they just ran.
 */
import type { ContentLine, ContentMeta, ContentStatus } from './contents.ts';

export interface ContentInputBody {
	type: string;
	title: string;
	description: string;
	/** Any YouTube URL shape or a bare id; '' clears it. */
	videoId: string;
	jlptLevel: string;
	difficulty: string;
	sourceType: string;
	sourceUrl: string;
	sourceName: string;
	license: string;
	rightsStatus: string;
}

/** A line as the editor holds it: no id, `order` is the row position. */
export interface LineDraft {
	startTime: number | null;
	endTime: number | null;
	originalText: string;
	kanaText: string;
	romajiText: string;
}

export type ApiResult<T> = { ok: true; body: T } | { ok: false; status: number; error: string };

async function call<T>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> {
	try {
		const res = await fetch(url, {
			method,
			...(body === undefined
				? {}
				: { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
		});
		if (!res.ok) return { ok: false, status: res.status, error: await errorMessage(res) };
		return { ok: true, body: (await res.json()) as T };
	} catch {
		return { ok: false, status: 0, error: 'network' };
	}
}

/** SvelteKit's `error()` answers `{ message }`; fall back to the status text. */
async function errorMessage(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as { message?: unknown };
		return typeof body.message === 'string' && body.message !== '' ? body.message : res.statusText;
	} catch {
		return res.statusText;
	}
}

export function createContent(input: ContentInputBody): Promise<ApiResult<ContentMeta>> {
	return call<ContentMeta>('/api/admin/contents', 'POST', input);
}

export function updateContent(
	id: string,
	patch: Partial<ContentInputBody>
): Promise<ApiResult<ContentMeta>> {
	return call<ContentMeta>(`/api/admin/contents/${id}`, 'PUT', patch);
}

export function deleteContent(id: string): Promise<ApiResult<{ deleted: true }>> {
	return call<{ deleted: true }>(`/api/admin/contents/${id}`, 'DELETE');
}

export function saveLines(
	id: string,
	lines: readonly LineDraft[]
): Promise<ApiResult<{ lines: ContentLine[] }>> {
	return call<{ lines: ContentLine[] }>(`/api/admin/contents/${id}/lines`, 'PUT', { lines });
}

export function setContentStatus(
	id: string,
	status: ContentStatus
): Promise<ApiResult<ContentMeta>> {
	return call<ContentMeta>(`/api/admin/contents/${id}/status`, 'POST', { status });
}
