// Vitest global setup — just confirms required env vars exist early with a
// clear message, rather than letting individual tests fail with a less
// helpful "fetch failed" once they try to hit Supabase.
import 'dotenv/config';

for (const name of ['FOOS_SUPABASE_URL', 'FOOS_SUPABASE_ANON_KEY']) {
  if (!process.env[name]) {
    throw new Error(
      `${name} is not set. Copy tests/.env.example to tests/.env and fill in ` +
        `the project's URL/anon key (same values as app/.env) before running the suite.`,
    );
  }
}
