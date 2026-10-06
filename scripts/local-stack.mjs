import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PROJECT_ID = 'VV-FoOS';
export const API_URL = 'http://127.0.0.1:56321';
export const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:56322/postgres';
export const PORTS = {
  'api.port': 56321,
  'db.port': 56322,
  'db.shadow_port': 56320,
  'studio.port': 56323,
  'local_smtp.port': 56324,
  'local_smtp.smtp_port': 56325,
  'local_smtp.pop3_port': 56326,
  'analytics.port': 56327,
  'edge_runtime.inspector_port': 56328,
  'db.pooler.port': 56329,
};

export function assertConfig(source = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')) {
  let section = '';
  const values = {};
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    const header = /^\[([\w.]+)\]$/.exec(line);
    if (header) section = header[1];
    const field = /^(\w+)\s*=\s*([^#]+)/.exec(line);
    if (field) values[section ? `${section}.${field[1]}` : field[1]] = field[2].trim();
  }
  if (values.project_id !== `"${PROJECT_ID}"`) throw new Error('Refusing: local project_id must be VV-FoOS.');
  for (const [key, port] of Object.entries(PORTS)) {
    if (Number(values[key]) !== port) throw new Error(`Refusing: ${key} must be ${port}.`);
  }
}

export function assertTarget(value, kind = 'api', allowRemote = false) {
  const url = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (allowRemote && !loopback) return value;
  const valid = kind === 'db'
    ? ['postgres:', 'postgresql:'].includes(url.protocol) && url.port === '56322' && url.pathname === '/postgres'
    : url.protocol === 'http:' && url.port === '56321' && ['/', ''].includes(url.pathname) && !url.username && !url.password;
  if (!loopback || !valid || url.search || url.hash) {
    throw new Error(`Refusing: ${kind} target must be the FOOS local endpoint on port ${kind === 'db' ? '56322' : '56321'}.`);
  }
  return value;
}

export function cliEnv(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith('SUPABASE_')));
}

export function supabase(args, options = {}) {
  assertConfig();
  return execFileSync('supabase', ['--workdir', ROOT, ...args], { ...options, cwd: ROOT, env: cliEnv() });
}

export function restartService(service, run = execFileSync) {
  assertConfig();
  if (!['edge_runtime', 'kong'].includes(service)) throw new Error('Unsupported FOOS restart service.');
  const name = `supabase_${service}_${PROJECT_ID}`;
  let running;
  try {
    running = run('docker', ['inspect', '--format', '{{.State.Running}}', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    console.warn(`post-reset: ${name} is unavailable; skipping restart.`);
    return false;
  }
  if (running !== 'true') return false;
  run('docker', ['restart', name], { stdio: 'ignore' });
  console.log(`post-reset: ${name} restarted.`);
  return true;
}

export async function assertPortsFree(ports = Object.values(PORTS)) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', () => reject(new Error(`FOOS port ${port} is occupied. No service was stopped or changed.`)));
      server.listen({ port, host: '0.0.0.0', exclusive: true }, () => server.close(resolve));
    });
  }
}
