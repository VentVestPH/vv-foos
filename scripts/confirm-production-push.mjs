import { existsSync, readFileSync } from 'node:fs';

const REF_FILE = 'supabase/.temp/project-ref';
const ref = existsSync(REF_FILE) ? readFileSync(REF_FILE, 'utf8').trim() : null;

if (!ref) {
  console.log('No linked project. `supabase db push` has no remote target; nothing to warn about.');
  process.exit(0);
}

if (process.env.FOOS_ALLOW_PRODUCTION_PUSH === 'yes') {
  console.log(`FOOS_ALLOW_PRODUCTION_PUSH=yes, proceeding against ${ref}.`);
  process.exit(0);
}

console.error(`
Refusing to run \`supabase db push\`.

This checkout is linked to project ${ref}, which is the LIVE project holding
real candidate and customer records. There is no staging project configured, so
db push is a production command.

The migration ledgers also do not line up. Ten migrations were applied to
production through the MCP connector on 2026-07-25 under generated timestamps;
the repo carries six hand-written files that reconstruct the same objects under
different names. Pushing after a \`migration repair --status reverted\` would
attempt those six against a database where the objects already exist.

Read the "Deployment state" section of
docs/environments/VVPH_VV-FOOS_Doc_Local-Development-Environment_2026-09-01_v1.0_Draft.md
before going further. It sets out the safe order: dump production, reconcile the
ledger per object, rehearse against a throwaway copy of the dump, then push only
the September migrations.

To develop, use the local stack instead:

  npm run db:reset

If you have read the above and genuinely intend to write to ${ref}:

  FOOS_ALLOW_PRODUCTION_PUSH=yes npm run db:push
`);
process.exit(1);
