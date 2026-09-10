import { describe, expect, it } from 'vitest';
import { adminEmails, isAdmin } from './admin.ts';

const ENV = { ADMIN_EMAILS: 'Owner@Example.com, second@example.com' };

describe('adminEmails', () => {
	it('splits, trims and lower-cases the var', () => {
		expect(adminEmails(ENV)).toEqual(['owner@example.com', 'second@example.com']);
	});

	it('is empty when the var is missing or blank', () => {
		expect(adminEmails(undefined)).toEqual([]);
		expect(adminEmails({ ADMIN_EMAILS: ' , ' })).toEqual([]);
	});
});

describe('isAdmin', () => {
	it('matches the e-mail case-insensitively', () => {
		expect(isAdmin({ email: 'owner@example.com' }, ENV)).toBe(true);
		expect(isAdmin({ email: 'OWNER@EXAMPLE.COM' }, ENV)).toBe(true);
		expect(isAdmin({ email: ' second@example.com ' }, ENV)).toBe(true);
	});

	it('refuses everyone else, including signed-out and e-mail-less users', () => {
		expect(isAdmin({ email: 'someone@example.com' }, ENV)).toBe(false);
		expect(isAdmin(null, ENV)).toBe(false);
		expect(isAdmin({ email: null }, ENV)).toBe(false);
		expect(isAdmin({ email: '' }, ENV)).toBe(false);
	});

	it('refuses everyone when the allowlist is unset', () => {
		expect(isAdmin({ email: 'owner@example.com' }, undefined)).toBe(false);
		expect(isAdmin({ email: 'owner@example.com' }, { ADMIN_EMAILS: '' })).toBe(false);
	});
});
