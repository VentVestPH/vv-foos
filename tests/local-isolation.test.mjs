import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { API_URL, DB_URL, ROOT, PORTS, assertConfig, assertTarget, assertPortsFree, cliEnv, restartService } from '../scripts/local-stack.mjs';

test('configuration reserves all ten distinct FOOS service ports', () => {
  assertConfig();
  assert.equal(new Set(Object.values(PORTS)).size, 10);
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  assert.throws(() => assertConfig(config.replace('project_id = "VV-FoOS"', 'project_id = "another-project"')));
  assert.throws(() => assertConfig(config.replace('smtp_port = 56325', 'smtp_port = 54325')));
});

test('foreign local targets and remote targets fail closed', () => {
  assert.equal(assertTarget(API_URL), API_URL);
  assert.equal(assertTarget(DB_URL, 'db'), DB_URL);
  for (const value of ['http://127.0.0.1:54321', 'http://localhost:55321', 'https://example.com', `${API_URL}/proxy`]) {
    assert.throws(() => assertTarget(value));
  }
  for (const value of ['postgresql://postgres:postgres@localhost:54322/postgres', DB_URL.replace(/\/postgres$/, '/other'), `${DB_URL}?host=example.com`]) {
    assert.throws(() => assertTarget(value, 'db'));
  }
  assert.throws(() => assertTarget('http://localhost:54321', 'api', true));
});

test('restart only addresses exact FOOS containers', (t) => {
  t.mock.method(console, 'log', () => {});
  for (const service of ['edge_runtime', 'kong']) {
    const calls = [];
    restartService(service, (command, args) => {
      calls.push([command, args]);
      return 'true\n';
    });
    assert.deepEqual(calls, [
      ['docker', ['inspect', '--format', '{{.State.Running}}', `supabase_${service}_VV-FoOS`]],
      ['docker', ['restart', `supabase_${service}_VV-FoOS`]],
    ]);
  }
});

test('missing FOOS container cannot fall back to a different project', (t) => {
  t.mock.method(console, 'warn', () => {});
  const calls = [];
  assert.equal(restartService('kong', (command, args) => {
    calls.push([command, args]);
    throw new Error('not found');
  }), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].at(-1), 'supabase_kong_VV-FoOS');
});

test('CLI environment cannot inherit a foreign project or port override', () => {
  assert.deepEqual(cliEnv({ PATH: '/bin', SUPABASE_PROJECT_ID: 'another-project', SUPABASE_DB_PORT: '54322', SUPABASE_SERVICE_ROLE_KEY: 'foreign' }), { PATH: '/bin' });
});

test('occupied port causes refusal while its listener remains running', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  try {
    await assert.rejects(assertPortsFree([server.address().port]), /occupied/);
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('stop anchors the CLI to FOOS and rejects arbitrary flags', () => {
  const dir = mkdtempSync(join(tmpdir(), 'foos-isolation-'));
  try {
    writeFileSync(join(dir, 'supabase'), '#!/bin/sh\nprintf "%s\\n" "$PWD" "$@"\n', { mode: 0o755 });
    const env = { ...cliEnv(), PATH: `${dir}:${process.env.PATH}`, FOOS_SUPABASE_URL: API_URL, FOOS_TARGET_URL: API_URL, FOOS_LOCAL_DB_URL: DB_URL, DATABASE_URL_LOCAL: DB_URL };
    const script = join(ROOT, 'scripts/local.mjs');
    const output = execFileSync(process.execPath, [script, 'stop'], { cwd: tmpdir(), env, encoding: 'utf8' });
    assert.deepEqual(output.trim().split('\n'), [ROOT.replace(/\/$/, ''), '--workdir', ROOT, 'stop', '--project-id', 'VV-FoOS']);
    const denied = spawnSync(process.execPath, [script, 'stop', '--all'], { env, encoding: 'utf8' });
    assert.notEqual(denied.status, 0);
    assert.equal(denied.stdout, '');
    const wrong = spawnSync(process.execPath, [script, 'reset'], { env: { ...env, FOOS_LOCAL_DB_URL: 'postgresql://postgres:postgres@localhost:54322/postgres' }, encoding: 'utf8' });
    assert.notEqual(wrong.status, 0);
    assert.equal(wrong.stdout, '');
    writeFileSync(join(dir, 'supabase'), '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 17\n', { mode: 0o755 });
    const reset = spawnSync(process.execPath, [script, 'reset'], { cwd: tmpdir(), env, encoding: 'utf8' });
    assert.notEqual(reset.status, 0);
    assert.deepEqual(reset.stdout.trim().split('\n'), ['--workdir', ROOT, 'db', 'reset', '--local']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('seed and validation scripts reject a different local database before execution', () => {
  const env = { ...cliEnv(), FOOS_LOCAL_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', FOOS_SUPABASE_URL: API_URL, FOOS_TARGET_URL: API_URL };
  for (const [script, args] of [['post-reset.mjs', ['--personas-only']], ['local-db.mjs', ['validate']], ['add-local-staff.mjs', []]]) {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /target must be the FOOS local endpoint/);
  }
});
