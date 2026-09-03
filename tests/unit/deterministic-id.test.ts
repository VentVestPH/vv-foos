import { describe, expect, it } from 'vitest';
import { deterministicId, isDuplicateKey } from '../../migration/src/deterministic-id.mjs';

describe('deterministic import ids', () => {
  it('is stable for the same entity type and Zoho id', () => {
    const a = deterministicId('candidate', '837085000004666040');
    const b = deterministicId('candidate', '837085000004666040');
    expect(a).toBe(b);
  });

  it('is a well formed v5 uuid', () => {
    const id = deterministicId('candidate', '837085000004666040');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('separates entity types, so a candidate and a contact with the same Zoho id differ', () => {
    expect(deterministicId('candidate', '123')).not.toBe(deterministicId('contact', '123'));
  });

  it('separates Zoho ids', () => {
    expect(deterministicId('candidate', '123')).not.toBe(deterministicId('candidate', '124'));
  });

  it('refuses an empty entity type or Zoho id, rather than hashing nothing', () => {
    expect(() => deterministicId('', '123')).toThrow();
    expect(() => deterministicId('candidate', '')).toThrow();
  });

  it('recognises a duplicate key by code and by message', () => {
    expect(isDuplicateKey({ code: '23505' })).toBe(true);
    expect(isDuplicateKey({ message: 'duplicate key value violates unique constraint' })).toBe(true);
    expect(isDuplicateKey({ code: '23503', message: 'foreign key violation' })).toBe(false);
    expect(isDuplicateKey(null)).toBe(false);
  });
});
