// Sign in locally without Google: insert a user + session into the local D1 and print the
// cookie to paste into the browser (DevTools → Application → Cookies, or a `document.cookie`
// line). Only touches `.wrangler/state` and only works against `pnpm dev` / `pnpm preview`.
//
// Usage: node scripts/dev-login.mjs <email> [name]
//   e.g. node scripts/dev-login.mjs m23568n@gmail.com   → an admin session (ADMIN_EMAILS)
//        node scripts/dev-login.mjs taro@example.com 太郎 → a plain user
//
// The cookie is `better-auth.session_token=<token>.<base64 HMAC-SHA256(secret, token)>`,
// signed with BETTER_AUTH_SECRET from .dev.vars (the same value the Worker verifies with).
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [email, name = 'dev'] = process.argv.slice(2);
if (!email) {
	console.error('usage: node scripts/dev-login.mjs <email> [name]');
	process.exit(1);
}
const vars = readFileSync('.dev.vars', 'utf8');
const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(vars)?.[1]?.trim().replace(/^"|"$/g, '');
if (!secret) throw new Error('BETTER_AUTH_SECRET missing in .dev.vars');

const now = Date.now();
const expires = now + 7 * 86_400_000;
const userId = `dev-${email.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
const token = `dev-${randomBytes(16).toString('hex')}`;
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const sql = [
	`INSERT OR IGNORE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (${q(userId)}, ${q(name)}, ${q(email)}, 1, NULL, ${now}, ${now});`,
	`INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) SELECT ${q(`s-${token}`)}, ${expires}, ${q(token)}, ${now}, ${now}, NULL, NULL, id FROM user WHERE email = ${q(email)};`
].join('\n');

const file = join(mkdtempSync(join(tmpdir(), 'jptype-login-')), 'login.sql');
writeFileSync(file, sql);
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--file', file], {
	stdio: ['ignore', 'ignore', 'inherit'],
	shell: process.platform === 'win32'
});

const signature = createHmac('sha256', secret).update(token).digest('base64');
const value = encodeURIComponent(`${token}.${signature}`);
console.log(`\nSigned in locally as ${email} (user id ${userId}); the session lasts 7 days.`);
console.log('Paste this in the browser console on http://localhost:5180 (or :4173):\n');
console.log(`document.cookie = "better-auth.session_token=${value}; path=/"\n`);
