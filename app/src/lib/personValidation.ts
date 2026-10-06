export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^\+?[0-9][0-9\s(),-]*$/;
export const PHONE_RULE = 'Phone can contain numbers, spaces, parentheses, dashes, and commas only.';

export function validateCandidateContact(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
): string | null {
  if (!firstName.trim()) return 'First name is required.';
  if (!lastName.trim()) return 'Last name is required.';
  if (!email.trim()) return 'Email is required.';
  return validateOptionalContact(email, phone);
}

export function validateContactPerson(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
): string | null {
  if (!firstName.trim() && !lastName.trim()) return 'A contact needs at least a first or last name.';
  return validateOptionalContact(email, phone);
}

function validateOptionalContact(email: string, phone: string): string | null {
  if (email.trim() && !EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) return PHONE_RULE;
  return null;
}
