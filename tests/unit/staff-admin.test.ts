import { describe, expect, it } from 'vitest';
import {
  guardAdminChange,
  normalizeEmail,
  parseNewStaff,
  parseStaffChange,
} from '../../supabase/functions/_shared/staff-admin.ts';

const ADMIN = { id: 'a1', role: 'admin', is_active: true };
const RECRUITER = { id: 'r1', role: 'recruiter', is_active: true };

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Roy@VentVest.com ')).toBe('roy@ventvest.com');
  });

  it('rejects text that is not an address', () => {
    expect(normalizeEmail('roy')).toBeNull();
    expect(normalizeEmail('roy@ventvest')).toBeNull();
    expect(normalizeEmail('roy @ventvest.com')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});

describe('parseStaffChange', () => {
  it('returns only the fields that were sent', () => {
    const parsed = parseStaffChange({ title: '  Founding   Director ' });
    expect(parsed).toEqual({ ok: true, value: { title: 'Founding Director' } });
  });

  it('turns an empty title into null so the column clears', () => {
    expect(parseStaffChange({ title: '   ' })).toEqual({ ok: true, value: { title: null } });
    expect(parseStaffChange({ title: null })).toEqual({ ok: true, value: { title: null } });
  });

  it('refuses a blank name, a bad email, an unknown role and a non-boolean flag', () => {
    expect(parseStaffChange({ fullName: '  ' }).ok).toBe(false);
    expect(parseStaffChange({ email: 'nope' }).ok).toBe(false);
    expect(parseStaffChange({ role: 'owner' }).ok).toBe(false);
    expect(parseStaffChange({ isActive: 'yes' }).ok).toBe(false);
  });

  it('accepts all four roles', () => {
    for (const role of ['admin', 'recruiter', 'sourcer', 'bd']) {
      expect(parseStaffChange({ role })).toEqual({ ok: true, value: { role } });
    }
  });

  it('returns an empty change when nothing is sent', () => {
    expect(parseStaffChange({})).toEqual({ ok: true, value: {} });
  });
});

describe('parseNewStaff', () => {
  it('requires a name, an email and a role', () => {
    expect(parseNewStaff({ email: 'a@b.co', role: 'bd' }).ok).toBe(false);
    expect(parseNewStaff({ fullName: 'A B', role: 'bd' }).ok).toBe(false);
    expect(parseNewStaff({ fullName: 'A B', email: 'a@b.co' }).ok).toBe(false);
  });

  it('normalises a complete record', () => {
    expect(
      parseNewStaff({ fullName: ' Amir  Horovitz ', email: 'Amir@B.co', role: 'admin', title: '' }),
    ).toEqual({
      ok: true,
      value: { fullName: 'Amir Horovitz', email: 'amir@b.co', title: null, role: 'admin' },
    });
  });
});

describe('guardAdminChange', () => {
  it('lets a non-admin change roles freely', () => {
    expect(guardAdminChange('a1', RECRUITER, { role: 'bd' }, 1)).toBeNull();
    expect(guardAdminChange('a1', RECRUITER, { isActive: false }, 1)).toBeNull();
  });

  it('lets an admin keep their role while other fields change', () => {
    expect(guardAdminChange('a1', ADMIN, { title: 'Director' }, 1)).toBeNull();
    expect(guardAdminChange('a1', ADMIN, { role: 'admin' }, 1)).toBeNull();
  });

  it('blocks an admin demoting or deactivating themselves', () => {
    expect(guardAdminChange('a1', ADMIN, { role: 'recruiter' }, 3)).toMatch(/your own/);
    expect(guardAdminChange('a1', ADMIN, { isActive: false }, 3)).toMatch(/your own/);
  });

  it('blocks removing the last active admin', () => {
    expect(guardAdminChange('other', ADMIN, { role: 'sourcer' }, 1)).toMatch(/At least one/);
    expect(guardAdminChange('other', ADMIN, { isActive: false }, 1)).toMatch(/At least one/);
  });

  it('allows removing an admin when another remains', () => {
    expect(guardAdminChange('other', ADMIN, { role: 'sourcer' }, 2)).toBeNull();
  });

  it('treats an inactive admin as not counting toward the guard', () => {
    const dormant = { id: 'd1', role: 'admin', is_active: false };
    expect(guardAdminChange('a1', dormant, { role: 'bd' }, 1)).toBeNull();
  });
});
