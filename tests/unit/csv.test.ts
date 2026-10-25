import { describe, expect, it } from 'vitest';
import { csvToTable, parseCsv } from '../../app/src/lib/csv';

describe('parseCsv', () => {
  it('reads quoted cells holding commas, doubled quotes and line breaks', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ]);
  });

  it('accepts CRLF endings, a byte order mark and a missing final newline', () => {
    expect(parseCsv('﻿a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops blank lines and keeps an empty trailing cell', () => {
    expect(parseCsv('a,b\n\n1,\n')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ]);
  });
});

describe('csvToTable', () => {
  it('keys each row by its heading, trims cells and names blank headings col_<index>', () => {
    const table = csvToTable('Name, Email ,\n Ann , a@x.test ,extra', 500);
    expect(table?.columns).toEqual(['Name', 'Email']);
    expect(table?.rows).toEqual([{ Name: 'Ann', Email: 'a@x.test', col_2: 'extra' }]);
    expect(table?.truncated).toBe(false);
  });

  it('caps the rows and says it truncated', () => {
    const table = csvToTable('a\n1\n2\n3', 2);
    expect(table?.rows).toHaveLength(2);
    expect(table?.truncated).toBe(true);
  });

  it('returns null for an empty file', () => {
    expect(csvToTable('  \n\n', 500)).toBeNull();
  });
});
