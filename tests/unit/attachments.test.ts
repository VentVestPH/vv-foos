import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  PENDING_FILE_LABEL,
  PENDING_FILE_REASON,
  attachmentRejection,
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

describe('attachmentRejection', () => {
  const file = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
    name: 'cv.pdf',
    size: 120000,
    type: 'application/pdf',
    ...over,
  });

  it('accepts an ordinary document', () => {
    expect(attachmentRejection(file())).toBeNull();
  });

  it('names the file and both sizes when it is too large', () => {
    const message = attachmentRejection(file({ size: MAX_ATTACHMENT_BYTES + 1 }));
    expect(message).toContain('cv.pdf');
    expect(message).toContain('25 MB');
  });

  it('accepts a file exactly on the limit', () => {
    expect(attachmentRejection(file({ size: MAX_ATTACHMENT_BYTES }))).toBeNull();
  });

  it('rejects an empty file rather than storing nothing', () => {
    expect(attachmentRejection(file({ size: 0 }))).toContain('empty');
  });

  it('rejects the two types Storage would serve as a rendering document', () => {
    expect(attachmentRejection(file({ name: 'x.svg', type: 'image/svg+xml' }))).toContain('cannot be attached');
    expect(attachmentRejection(file({ name: 'x.html', type: 'text/html' }))).toContain('cannot be attached');
  });

  it('treats a browser that sends no type as an opaque download', () => {
    expect(attachmentRejection(file({ name: 'notes', type: '' }))).toBeNull();
  });

  it('mirrors the bucket allowlist, so the client and the server agree', () => {
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      expect(attachmentRejection(file({ type }))).toBeNull();
    }
    expect(ALLOWED_ATTACHMENT_TYPES).not.toContain('image/svg+xml');
    expect(ALLOWED_ATTACHMENT_TYPES).not.toContain('text/html');
  });
});
