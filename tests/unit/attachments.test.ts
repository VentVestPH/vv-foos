import { describe, expect, it } from 'vitest';
import {
  PENDING_FILE_LABEL,
  PENDING_FILE_REASON,
  isPendingFile,
} from '../../app/src/lib/attachments';

describe('isPendingFile', () => {
  it('recognises both placeholder prefixes the migration has used', () => {
    expect(isPendingFile('zoho-import/pending/abc/resume.pdf')).toBe(true);
    expect(isPendingFile('pending-file-export/abc/resume.pdf')).toBe(true);
  });

  it('treats a real uploaded path as available', () => {
    expect(isPendingFile('candidate/abc/1788300000000_resume.pdf')).toBe(false);
    expect(isPendingFile('intake/abc/resume.pdf')).toBe(false);
  });

  it('does not match a prefix that merely appears later in the path', () => {
    expect(isPendingFile('candidate/abc/pending-file-export/resume.pdf')).toBe(false);
  });

  it('handles a null or empty path without throwing', () => {
    expect(isPendingFile(null)).toBe(false);
    expect(isPendingFile(undefined)).toBe(false);
    expect(isPendingFile('')).toBe(false);
  });

  it('carries a label and a reason for the UI to show', () => {
    expect(PENDING_FILE_LABEL.length).toBeGreaterThan(0);
    expect(PENDING_FILE_REASON).toContain('Zoho');
  });
});
