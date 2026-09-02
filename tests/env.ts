import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} — see tests/.env.example`);
  return v;
}

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

export const PERSONA_CREDENTIALS: Record<Persona, { email: string; password: string }> = {
  admin: { email: 'demo-admin@ventvest.test', password: requiredTestPassword() },
  recruiter: { email: 'rita.demo@ventvest.com', password: requiredTestPassword() },
  sourcer: { email: 'sam.demo@ventvest.com', password: requiredTestPassword() },
  bd: { email: 'ben.demo@ventvest.com', password: requiredTestPassword() },
};

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

export function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
