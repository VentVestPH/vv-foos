import type { EditField, EditValue } from './RecordEditDialog';
import { supabase } from '../../lib/supabase';
import type { Json } from '../../lib/database.types';
import { countryOptions } from '../../lib/countries';
import { validateCandidateContact, validateContactPerson } from '../../lib/personValidation';

export interface EditablePerson {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  headline: string | null;
  emails: Json;
  phones: Json;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  linkedin_public_url: string | null;
  linkedin_recruiter_url: string | null;
  online_resume_url: string | null;
}

const NAME = 'Name';
const REACH = 'Contact';
const PLACE = 'Location';
const LINKS = 'Profiles';

const PERSON_EDIT_FIELDS: EditField[] = [
  { kind: 'text', key: 'first_name', label: 'First name', section: NAME },
  { kind: 'text', key: 'middle_name', label: 'Middle name', section: NAME },
  { kind: 'text', key: 'last_name', label: 'Last name', section: NAME },
  { kind: 'text', key: 'headline', label: 'Headline', section: NAME, span: true },
  { kind: 'email', key: 'email', label: 'Email', section: REACH },
  { kind: 'text', key: 'phone', label: 'Phone', section: REACH },
  { kind: 'text', key: 'street', label: 'Street', section: PLACE, span: true },
  { kind: 'text', key: 'city', label: 'City', section: PLACE },
  { kind: 'text', key: 'state', label: 'State / region', section: PLACE },
  { kind: 'text', key: 'postal_code', label: 'Postal code', section: PLACE },
  { kind: 'select', key: 'country', label: 'Country', section: PLACE, options: countryOptions(null) },
  { kind: 'url', key: 'linkedin_public_url', label: 'LinkedIn public', section: LINKS },
  { kind: 'url', key: 'linkedin_recruiter_url', label: 'LinkedIn Recruiter', section: LINKS },
  { kind: 'url', key: 'online_resume_url', label: 'Online resume', section: LINKS, span: true },
];

export function personEditFields(person: EditablePerson): EditField[] {
  return PERSON_EDIT_FIELDS.map((field) =>
    field.key === 'country' && field.kind === 'select'
      ? { ...field, options: countryOptions(person.country) }
      : field,
  );
}

export type PersonKind = 'candidate' | 'contact';

function validatePersonDraft(draft: Record<string, EditValue>, kind: PersonKind): string | null {
  const read = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string).trim() : '');
  const validate = kind === 'candidate' ? validateCandidateContact : validateContactPerson;
  return validate(read('first_name'), read('last_name'), read('email'), read('phone'));
}

function firstEntry(value: Json, key: 'address' | 'number'): string {
  if (!Array.isArray(value)) return '';
  const head = value[0];
  if (!head || typeof head !== 'object' || Array.isArray(head)) return '';
  const found = (head as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : '';
}

function withFirst(value: Json, key: 'address' | 'number', next: string, type: string): Json {
  const list = Array.isArray(value) ? [...value] : [];
  if (!next) {
    list.shift();
    return list as unknown as Json;
  }
  const head = list[0];
  if (head && typeof head === 'object' && !Array.isArray(head)) {
    list[0] = { ...(head as Record<string, string>), [key]: next } as unknown as Json;
  } else {
    list.unshift({ type, [key]: next } as unknown as Json);
  }
  return list as unknown as Json;
}

export function personEditValues(person: EditablePerson): Record<string, EditValue> {
  return {
    first_name: person.first_name ?? '',
    middle_name: person.middle_name ?? '',
    last_name: person.last_name ?? '',
    headline: person.headline ?? '',
    email: firstEntry(person.emails, 'address'),
    phone: firstEntry(person.phones, 'number'),
    street: person.street ?? '',
    city: person.city ?? '',
    state: person.state ?? '',
    postal_code: person.postal_code ?? '',
    country: person.country ?? '',
    linkedin_public_url: person.linkedin_public_url ?? '',
    linkedin_recruiter_url: person.linkedin_recruiter_url ?? '',
    online_resume_url: person.online_resume_url ?? '',
  };
}

export async function savePerson(
  person: EditablePerson,
  draft: Record<string, EditValue>,
  kind: PersonKind,
): Promise<void> {
  const text = (v: EditValue | undefined) => (typeof v === 'string' ? v.trim() || null : null);
  const validationError = validatePersonDraft(draft, kind);
  if (validationError) throw new Error(validationError);
  const first = text(draft.first_name);
  const last = text(draft.last_name);

  const { error } = await supabase
    .from('people')
    .update({
      first_name: first,
      middle_name: text(draft.middle_name),
      last_name: last,
      headline: text(draft.headline),
      emails: withFirst(person.emails, 'address', String(draft.email ?? '').trim(), 'work'),
      phones: withFirst(person.phones, 'number', String(draft.phone ?? '').trim(), 'work'),
      street: text(draft.street),
      city: text(draft.city),
      state: text(draft.state),
      postal_code: text(draft.postal_code),
      country: text(draft.country),
      linkedin_public_url: text(draft.linkedin_public_url),
      linkedin_recruiter_url: text(draft.linkedin_recruiter_url),
      online_resume_url: text(draft.online_resume_url),
    })
    .eq('id', person.id);
  if (error) throw new Error(error.message);
}
