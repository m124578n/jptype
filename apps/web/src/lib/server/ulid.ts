// Crockford base32 ULID (26 chars): 48-bit ms timestamp + 80 bits of randomness.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encode(value: number, length: number): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		out = ALPHABET[value % 32] + out;
		value = Math.floor(value / 32);
	}
	return out;
}

export function ulid(nowMs = Date.now(), random: () => Uint8Array = randomBytes): string {
	const bytes = random();
	let rand = '';
	for (let i = 0; i < 16; i++) rand += ALPHABET[(bytes[i] as number) % 32];
	return encode(nowMs, 10) + rand;
}

function randomBytes(): Uint8Array {
	const b = new Uint8Array(16);
	crypto.getRandomValues(b);
	return b;
}
