import 'dotenv/config';

const target = new URL(process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321');
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.port !== '56321') {
  throw new Error('FOOS tests require the isolated local Supabase endpoint at http://127.0.0.1:56321.');
}
