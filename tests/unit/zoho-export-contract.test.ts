import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCsvRecords } from '../../migration/src/csv.mjs';

const EXPORTS = fileURLToPath(new URL('../../migration/zoho-exports', import.meta.url));

function rows(file: string): Record<string, string>[] {
  const raw = readFileSync(`${EXPORTS}/${file}`).toString('utf8');
  return parseCsvRecords(raw).records;
}

const present = existsSync(`${EXPORTS}/Candidates_001.csv`);

describe.skipIf(!present)('the Zoho export data contract the importer depends on', () => {
  it('every export identifies records with the Zrecruit_ prefix, on both sides of the join', () => {
    const cand = rows('Candidates_001.csv').map((r) => r['Candidate Id'] ?? '');
    const att = rows('Attachments_001.csv').map((r) => r['Parent Id'] ?? '');
    const note = rows('Notes_001.csv').map((r) => r['Parent Id'] ?? '');

    for (const [label, values] of [
      ['Candidates.Candidate Id', cand],
      ['Attachments.Parent Id', att],
      ['Notes.Parent Id', note],
    ] as const) {
      expect(values.length, `${label} has rows`).toBeGreaterThan(0);
      const bare = values.filter((v) => v && !v.startsWith('Zrecruit_'));
      expect(
        bare.slice(0, 3),
        `${label} must use the prefixed form on both sides of the join. If Zoho ever exports ` +
          'bare ids, the importer joins nothing and reports every child as parentless',
      ).toEqual([]);
    }
  });

  it('attachment parents resolve against candidate ids verbatim, with no normalisation', () => {
    const candIds = new Set(rows('Candidates_001.csv').map((r) => r['Candidate Id'] ?? ''));
    const parents = [...new Set(rows('Attachments_001.csv').map((r) => r['Parent Id'] ?? ''))].filter(
      (p) => p !== '',
    );
    const matched = parents.filter((p) => candIds.has(p));
    expect(
      matched.length,
      'the CSV to CSV join needs no prefix handling because both sides are prefixed; ' +
        'the API is the side that uses bare numeric ids',
    ).toBe(parents.length);
  });

  it('Attachment URL is empty in every row, which is why the bytes need another source', () => {
    const att = rows('Attachments_001.csv');
    const withUrl = att.filter((r) => (r['Attachment URL'] ?? '').trim() !== '');
    expect(
      withUrl.length,
      'if Zoho ever populates Attachment URL, the attachment bytes could come from the export ' +
        'and U3 would not need the UI backup',
    ).toBe(0);
  });

  it('the education and experience exports are header only, so there is nothing to migrate', () => {
    for (const file of ['Candidates_Educational_Details.csv', 'Candidates_Experience_Details.csv']) {
      expect(rows(file).length, `${file} carries no data rows`).toBe(0);
    }
  });
});
