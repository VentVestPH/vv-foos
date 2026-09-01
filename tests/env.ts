// Shared test client factory. Every API test signs in as a real persona via
// email/password (the architecture's documented fallback auth method) and
// gets a real Supabase-issued JWT — this is what makes these "through the
// API, not just psql" per brief instruction 3, as opposed to the
// request.jwt.claims simulation validate.sql uses.
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} — see tests/.env.example`);
  return v;
}

// SECURITY: the persona password must come from the environment. It previously
// defaulted to a literal that is a WORKING credential against the live project
// (all four personas authenticate against the hosted database, which holds real
// candidate PII). Committing that literal put a production credential in git
// history. Tracked as QA-003. Fail loudly instead.
function requiredTestPassword(): string {
  const value = process.env.FOOS_QA_TEST_PASSWORD;
  if (!value) {
    throw new Error(
      'FOOS_QA_TEST_PASSWORD is not set. Copy tests/.env.example to tests/.env ' +
        'and set it to the value used when seeding tests/fixtures/personas.sql.',
    );
  }
  return value;
}

export const SUPABASE_URL = env('FOOS_SUPABASE_URL');
export const SUPABASE_ANON_KEY = env('FOOS_SUPABASE_ANON_KEY');

export type Persona = 'admin' | 'recruiter' | 'sourcer' | 'bd';

// These map to the four seeded demo staff rows (a0000000-...-0001..0004)
// that validate.sql's RLS checks already exercise via psql role simulation.
// QA-created Auth identities (see tests/fixtures/personas.sql) give them
// real sign-in capability for these API tests. Passwords are QA-known test
// values — rotate or remove these Auth identities before real-user cutover
// (flagged in the defect log, QA-003).
export const PERSONA_CREDENTIALS: Record<Persona, { email: string; password: string }> = {
  admin: { email: 'demo-admin@ventvest.test', password: requiredTestPassword() },
  recruiter: { email: 'rita.demo@ventvest.com', password: requiredTestPassword() },
  sourcer: { email: 'sam.demo@ventvest.com', password: requiredTestPassword() },
  bd: { email: 'ben.demo@ventvest.com', password: requiredTestPassword() },
};

/** A fresh, signed-in client for the given persona — real JWT, real REST calls. */
export async function clientAs(persona: Persona) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { email, password } = PERSONA_CREDENTIALS[persona];
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      `Could not sign in as ${persona} (${email}): ${error.message}. ` +
        `Run tests/fixtures/personas.sql against the project first.`,
    );
  }
  return client;
}

/** Anonymous (signed-out) client — for careers-page/public-endpoint tests. */
export function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
