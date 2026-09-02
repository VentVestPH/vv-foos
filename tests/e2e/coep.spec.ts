import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { clientAs } from '../env';
import { SEED_PEOPLE_IDS } from '../fixtures/seed-ids';

const BUCKET = 'attachments';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

let server: Server;
let harnessOrigin: string;
let signedUrl: string;
let storagePath: string;
let attachmentId: string;
let coep = true;

function harness(url: string): string {
  return `<!doctype html><meta charset="utf-8"><title>coep probe</title>
<img id="nocors" src="${url}">
<img id="cors" src="${url}" crossorigin="anonymous">
<iframe id="frame" src="${url}" title="probe"></iframe>`;
}

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const personId = Object.values(SEED_PEOPLE_IDS)[0] as string;
  storagePath = `person/${personId}/coep-${process.pid}-${Math.random().toString(36).slice(2, 8)}.png`;
  const up = await admin.storage
    .from(BUCKET)
    .upload(storagePath, new Blob([PNG], { type: 'image/png' }));
  expect(up.error, up.error?.message).toBeNull();
  const row = await admin
    .from('attachments')
    .insert({ storage_path: storagePath, parent_type: 'person', parent_id: personId, kind: 'other' })
    .select('id')
    .single();
  expect(row.error, row.error?.message).toBeNull();
  attachmentId = row.data!.id;
  const signed = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  expect(signed.error, signed.error?.message).toBeNull();
  signedUrl = signed.data!.signedUrl;
  expect(new URL(signedUrl).origin).not.toBe(harnessOrigin);

  server = createServer((req, res) => {
    const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
    if (coep) {
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    }
    res.writeHead(200, headers);
    res.end(harness(signedUrl));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  harnessOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  const admin = await clientAs('admin');
  if (storagePath) await admin.storage.from(BUCKET).remove([storagePath]);
  if (attachmentId) await admin.from('attachments').delete().eq('id', attachmentId);
});

async function probe(page: Page) {
  const blocked: string[] = [];
  page.on('requestfailed', (r) => blocked.push(`${r.resourceType()} ${r.failure()?.errorText ?? ''}`));
  await page.goto(harnessOrigin, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const widths = await page.evaluate(() => ({
    nocors: (document.getElementById('nocors') as HTMLImageElement).naturalWidth,
    cors: (document.getElementById('cors') as HTMLImageElement).naturalWidth,
  }));
  return { blocked, ...widths, frames: page.frames().length };
}

test.describe('M10 Cross-Origin-Embedder-Policy: require-corp', () => {
  test('Supabase Storage sends no Cross-Origin-Resource-Policy header', async ({ request }) => {
    const res = await request.get(signedUrl);
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers['cross-origin-resource-policy']).toBeUndefined();
    expect(headers['cross-origin-embedder-policy']).toBeUndefined();
    expect(headers['access-control-allow-origin']).toBe('*');
  });

  test('without the header every cross-origin embed loads', async ({ page }) => {
    coep = false;
    const r = await probe(page);
    expect(r.nocors).toBeGreaterThan(0);
    expect(r.cors).toBeGreaterThan(0);
    expect(r.frames).toBe(2);
    expect(r.blocked).toEqual([]);
  });

  test('require-corp blocks the no-cors image and the resume preview iframe', async ({ page }) => {
    coep = true;
    const r = await probe(page);
    expect(r.nocors).toBe(0);
    expect(r.cors).toBeGreaterThan(0);
    expect(r.blocked).toContain(
      'image net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep',
    );
    expect(r.blocked).toContain('document net::ERR_BLOCKED_BY_RESPONSE');
  });
});
