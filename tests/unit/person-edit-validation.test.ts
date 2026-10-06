import { describe, expect, it } from 'vitest';
import { validateCandidateContact, validateContactPerson } from '../../app/src/lib/personValidation';

const valid = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+44 (20) 1234-5678, 9',
};

describe('candidate contact validation', () => {
  it('requires first name, last name, and email', () => {
    expect(validateCandidateContact('', valid.last_name, valid.email, valid.phone)).toBe('First name is required.');
    expect(validateCandidateContact(valid.first_name, '', valid.email, valid.phone)).toBe('Last name is required.');
    expect(validateCandidateContact(valid.first_name, valid.last_name, '', valid.phone)).toBe('Email is required.');
  });

  it('rejects malformed email addresses', () => {
    expect(validateCandidateContact(valid.first_name, valid.last_name, 'ada.example.com', valid.phone)).toBe(
      'Enter a valid email address.',
    );
  });

  it('accepts international phone punctuation and rejects letters', () => {
    expect(validateCandidateContact(valid.first_name, valid.last_name, valid.email, valid.phone)).toBeNull();
    expect(validateCandidateContact(valid.first_name, valid.last_name, valid.email, '555 CALL ADA')).toMatch(/Phone can contain/);
  });

  it('allows an empty optional phone', () => {
    expect(validateCandidateContact(valid.first_name, valid.last_name, valid.email, '')).toBeNull();
  });
});

describe('contact validation', () => {
  it('needs only a first or last name', () => {
    expect(validateContactPerson('', '', '', '')).toBe('A contact needs at least a first or last name.');
    expect(validateContactPerson('Grace', '', '', '')).toBeNull();
    expect(validateContactPerson('', 'Hopper', '', '')).toBeNull();
  });

  it('accepts a contact with no email but still rejects a malformed one', () => {
    expect(validateContactPerson('Grace', 'Hopper', '', '')).toBeNull();
    expect(validateContactPerson('Grace', 'Hopper', 'grace.example.com', '')).toBe('Enter a valid email address.');
  });

  it('applies the same phone rule as candidates', () => {
    expect(validateContactPerson('Grace', 'Hopper', '', 'CALL ME')).toMatch(/Phone can contain/);
  });
});
