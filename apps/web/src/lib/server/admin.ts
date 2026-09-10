/**
 * Who may use `/admin` and `/api/admin/*` (DECISIONS「歌曲功能定案」item 5).
 *
 * The allowlist is the `ADMIN_EMAILS` var in `wrangler.jsonc` (comma separated). Google is the
 * only login provider, so every account has a verified e-mail to compare against. The check is
 * server-side on every admin route; the client only gets a boolean to decide whether to draw
 * the nav link.
 */

/** Only the fields we compare, so tests (and `+layout.server.ts`) need no full session object. */
export interface AdminUser {
	email?: string | null;
}

export function adminEmails(env: { ADMIN_EMAILS?: string } | undefined): string[] {
	return (env?.ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter((e) => e !== '');
}

/** Case-insensitive membership of `user.email` in `ADMIN_EMAILS`. */
export function isAdmin(
	user: AdminUser | null | undefined,
	env: { ADMIN_EMAILS?: string } | undefined
): boolean {
	const email = user?.email?.trim().toLowerCase();
	if (!email) return false;
	return adminEmails(env).includes(email);
}
