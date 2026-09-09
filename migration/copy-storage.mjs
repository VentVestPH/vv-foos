import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const BUCKET = valueOf('--bucket', 'attachments');
const APPLY = has('--apply');
const LIMIT = Number(valueOf('--limit', '0')) || 0;
const PAGE = 1000;

const SRC_URL = process.env.SRC_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const SRC_KEY = process.env.SRC_SERVICE_ROLE_KEY;
const DST_URL = process.env.DST_SUPABASE_URL;
const DST_KEY = process.env.DST_SERVICE_ROLE_KEY;

if (!SRC_KEY || !DST_URL || !DST_KEY) {
  console.error(
    'Needs SRC_SERVICE_ROLE_KEY, DST_SUPABASE_URL and DST_SERVICE_ROLE_KEY.\n' +
      'SRC_SUPABASE_URL defaults to the local stack.',
  );
  process.exit(1);
}
if (/127\.0\.0\.1|localhost/.test(String(DST_URL))) {
  console.error('DST_SUPABASE_URL points at the local stack; that is a copy onto itself.');
  process.exit(1);
}

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

async function listAll(client, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listAll(client, path)));
      else out.push({ path, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype ?? null });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

const source = await listAll(src);
const already = new Set((await listAll(dst)).map((o) => o.path));
const todo = source.filter((o) => !already.has(o.path)).slice(0, LIMIT || undefined);
const bytes = todo.reduce((n, o) => n + Number(o.size ?? 0), 0);

console.log(`bucket ${BUCKET}`);
console.log(`  source objects      ${source.length}`);
console.log(`  already at target   ${already.size}`);
console.log(`  to copy             ${todo.length} (${(bytes / 1048576).toFixed(1)} MB)`);

if (!APPLY) {
  console.log('\nDry run. Nothing copied. Re-run with --apply.');
  process.exit(0);
}

let copied = 0;
let failed = 0;
const problems = [];
for (const object of todo) {
  try {
    const { data, error } = await src.storage.from(BUCKET).download(object.path);
    if (error) throw new Error(`download: ${error.message}`);
    const body = new Uint8Array(await data.arrayBuffer());
    const { error: upErr } = await dst.storage
      .from(BUCKET)
      .upload(object.path, body, { contentType: object.mime ?? 'application/octet-stream', upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    copied += 1;
  } catch (e) {
    failed += 1;
    problems.push(`${object.path}: ${e.message ?? e}`);
  }
  if ((copied + failed) % 100 === 0) {
    console.log(`  ${copied + failed}/${todo.length} processed, ${copied} copied, ${failed} failed`);
  }
}

console.log(`\n  copied ${copied}`);
console.log(`  failed ${failed}`);
for (const p of problems.slice(0, 20)) console.log(`    - ${p}`);
if (problems.length > 20) console.log(`    ... and ${problems.length - 20} more`);
if (failed > 0) process.exitCode = 1;
