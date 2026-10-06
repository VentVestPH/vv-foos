import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EXPORTABLE_MODULES } from '../../app/src/modules/settings/lib';
import { PERSONA_CREDENTIALS } from '../env';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const PASSWORD = process.env.FOOS_QA_TEST_PASSWORD ?? '';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let admin: SupabaseClient;
let bd: SupabaseClient;

beforeAll(async () => {
  admin = await signIn(PERSONA_CREDENTIALS.admin.email);
  bd = await signIn(PERSONA_CREDENTIALS.bd.email);
});

describe('U6: every column the Settings exporter declares actually exists', () => {
  it('has at least the six list modules registered', () => {
    expect(EXPORTABLE_MODULES.length).toBeGreaterThanOrEqual(6);
  });

  for (const m of EXPORTABLE_MODULES) {
    it(`${m.key}: selects only columns ${m.view} has`, async () => {
      const { error } = await admin
        .from(m.view)
        .select(m.columns.map((c) => c.key).join(', '))
        .limit(1);
      expect(
        error?.message ?? null,
        'a column name in the registry that the view does not have fails only at runtime, ' +
          'because the select list is a string the compiler never sees',
      ).toBeNull();
    });

    it(`${m.key}: orders by a column ${m.view} has, so paging is stable`, async () => {
      const { error } = await admin.from(m.view).select(m.orderBy).order(m.orderBy).limit(1);
      expect(error?.message ?? null).toBeNull();
    });
  }
});

describe('U6.5: an export returns the module row count, through RLS', () => {
  for (const m of EXPORTABLE_MODULES) {
    it(`${m.key}: paging the view returns exactly its counted rows`, async () => {
      const { count, error: countErr } = await admin
        .from(m.view)
        .select('*', { count: 'exact', head: true });
      expect(countErr).toBeNull();
      const total = count ?? 0;

      const page = 1000;
      let fetched = 0;
      for (let start = 0; start < total; start += page) {
        const { data, error } = await admin
          .from(m.view)
          .select(m.columns.map((c) => c.key).join(', '))
          .order(m.orderBy, { ascending: true })
          .range(start, start + page - 1);
        expect(error?.message ?? null).toBeNull();
        fetched += (data ?? []).length;
      }
      expect(
        fetched,
        'an export that silently returns fewer rows than the count beside it is the ' +
          'defect this whole workstream started with',
      ).toBe(total);
    }, 90000);
  }

  it('the exporter reads through RLS, so a bd persona gets no candidates at all', async () => {
    const adminCount = await admin
      .from('candidate_list')
      .select('*', { count: 'exact', head: true });
    const bdCount = await bd.from('candidate_list').select('*', { count: 'exact', head: true });
    expect(adminCount.error).toBeNull();
    expect(
      bdCount.count ?? 0,
      'bd has no candidate access, so an export of candidates must come back empty ' +
        'rather than relying on the UI to hide the button',
    ).toBe(0);
    expect(adminCount.count ?? 0).toBeGreaterThan(0);
  });
});

describe('U6.4: RFC 4180 round trip on a value that would break a naive parser', () => {
  let personId: string | null = null;
  const nastyLast = `Zexp${RUN}\nsecond "line", with comma`;

  beforeAll(async () => {
    const { data, error } = await admin
      .from('people')
      .insert({ first_name: 'Zexport', last_name: nastyLast, is_test: true })
      .select('id')
      .single();
    if (error) throw error;
    personId = data.id;
    const profile = await admin.from('candidate_profiles').insert({ person_id: personId });
    if (profile.error) throw profile.error;
  });

  afterAll(async () => {
    if (!personId) return;
    const profile = await admin.from('candidate_profiles').delete().eq('person_id', personId);
    expect(profile.error).toBeNull();
    const person = await admin.from('people').delete().eq('id', personId);
    expect(person.error).toBeNull();
  });

  it('a value holding a newline, a quote and a comma survives escaping and parsing', async () => {
    const { data, error } = await admin
      .from('candidate_list')
      .select('person_id, first_name, last_name')
      .eq('person_id', personId!)
      .single();
    expect(error).toBeNull();
    expect(data!.last_name).toBe(nastyLast);

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = `First Name,Last Name\n${escape(data!.first_name)},${escape(data!.last_name)}`;

    const parsed: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < csv.length; i += 1) {
      const ch = csv[i];
      if (quoted) {
        if (ch === '"' && csv[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cell += ch;
        }
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        parsed.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') cell += ch;
    }
    row.push(cell);
    parsed.push(row);

    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toHaveLength(2);
    expect(
      parsed[1][1],
      'a newline inside a quoted field must not split the record, which is what a ' +
        'naive split on newline does and what broke four hand-rolled parsers earlier',
    ).toBe(nastyLast);
  });
});
