import { describe, expect, it } from 'vitest';
import {
  BULK_ALIASES,
  buildBulkColumnMap,
  bulkRowToExportRow,
  missingExportColumns,
  unmappedBulkColumns,
} from '../../migration/src/bulk-to-export.mjs';

const UI_HEADER = ['Record Id', 'Account Owner', 'Account Name', 'Created Time', 'Modified Time'];

describe('mapping bulk read columns onto the export names the mappers already read', () => {
  it('derives the mechanical cases without any alias', () => {
    const map = buildBulkColumnMap(UI_HEADER);
    expect(map.get('Account_Name')).toBe('Account Name');
    expect(map.get('Created_Time')).toBe('Created Time');
  });

  it('needs an alias where the bulk name is not a derivation of the export name', () => {
    const map = buildBulkColumnMap(UI_HEADER);
    expect(map.get('Owner'), 'bulk read calls it Owner, the export calls it Account Owner').toBeUndefined();
    expect(map.get('Id'), 'bulk read calls it Id, the export calls it Record Id').toBeUndefined();
  });

  it('resolves every field the CRM company mapper reads, once aliased', () => {
    const map = buildBulkColumnMap(UI_HEADER);
    const row = {
      Id: '7079769000000598204',
      Owner: 'John Buena',
      Account_Name: 'Aster Analytics',
      Created_Time: '2025-09-25T06:56:49+08:00',
      Modified_Time: '2026-01-01T12:03:54+08:00',
    };
    const mapped = bulkRowToExportRow(row, map, BULK_ALIASES['ZohoCRM/Accounts']);
    expect(missingExportColumns(UI_HEADER, mapped)).toEqual([]);
    expect(mapped['Account Owner']).toBe('John Buena');
    expect(mapped['Record Id']).toBe('7079769000000598204');
  });

  it('reports bulk columns with no export equivalent, so a silent drop is visible', () => {
    const map = buildBulkColumnMap(UI_HEADER);
    const row = { Account_Name: 'x', Exchange_Rate: '1.0', Currency: 'USD' };
    expect(unmappedBulkColumns(row, map)).toEqual(['Exchange_Rate', 'Currency']);
  });

  it('ignores the parser own __row field and Zoho $ internals', () => {
    const map = buildBulkColumnMap(UI_HEADER);
    const row = { __row: 2, $editable: true, Account_Name: 'x' };
    expect(unmappedBulkColumns(row, map)).toEqual([]);
    expect(bulkRowToExportRow(row, map)).toEqual({ 'Account Name': 'x' });
  });

  it('turns a null bulk value into an empty string rather than dropping the column', () => {
    const map = buildBulkColumnMap(UI_HEADER);
    const mapped = bulkRowToExportRow({ Account_Name: null }, map);
    expect(mapped['Account Name']).toBe('');
  });
});

describe('the candidate aliases that are not mechanical derivations', () => {
  const header = ['Candidate Id', 'Postal Code', 'LinkedIn', 'Facebook', 'LinkedIn Recruiter'];

  it('maps Zip_Code, LinkedIn__s and Facebook__s onto the names the mapper reads', () => {
    const columnMap = buildBulkColumnMap(header);
    const out = bulkRowToExportRow(
      {
        Id: '837085000000540058',
        Zip_Code: '1101',
        LinkedIn__s: 'https://linkedin.com/in/example',
        Facebook__s: 'https://facebook.com/example',
        LinkedIn_Recruiter: 'https://recruiter.example',
      },
      columnMap,
      BULK_ALIASES['ZohoRecruit/Candidates'],
    );
    expect(out['Postal Code']).toBe('1101');
    expect(out.LinkedIn).toBe('https://linkedin.com/in/example');
    expect(out.Facebook).toBe('https://facebook.com/example');
  });

  it('still derives LinkedIn Recruiter mechanically, so the alias table stays minimal', () => {
    const out = bulkRowToExportRow(
      { LinkedIn_Recruiter: 'https://recruiter.example' },
      buildBulkColumnMap(header),
      BULK_ALIASES['ZohoRecruit/Candidates'],
    );
    expect(out['LinkedIn Recruiter']).toBe('https://recruiter.example');
  });
});

describe('the note owner alias, which the UI header alone cannot supply', () => {
  it('routes Note_Owner into Note Owner Id and keeps the id, not the name', () => {
    const header = ['Note Id', 'Note Owner Id', 'Note Title', 'Parent Id'];
    const out = bulkRowToExportRow(
      {
        Id: '837085000004992033',
        Note_Owner: { name: 'A Recruiter', id: '837085000000554395' },
        Note_Title: 'Call',
      },
      buildBulkColumnMap(header),
      BULK_ALIASES['ZohoRecruit/Notes'],
    );
    expect(out['Note Id']).toBe('837085000004992033');
    expect(out['Note Owner Id']).toBe('837085000000554395');
  });

  it('still accepts the plain Owner key the other modules use', () => {
    const out = bulkRowToExportRow(
      { Owner: { name: 'A Recruiter', id: '837085000000554395' } },
      buildBulkColumnMap(['Note Owner Id']),
      BULK_ALIASES['ZohoRecruit/Notes'],
    );
    expect(out['Note Owner Id']).toBe('837085000000554395');
  });
});
