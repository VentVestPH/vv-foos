const PENDING_PREFIXES = ['zoho-import/pending/', 'pending-file-export/'];

export const PENDING_FILE_LABEL = 'File not yet available';

export const PENDING_FILE_REASON =
  'This record came from the Zoho migration. The file itself has not been transferred yet, so there is nothing to open.';

export function isPendingFile(storagePath: string | null | undefined): boolean {
  if (!storagePath) return false;
  return PENDING_PREFIXES.some((prefix) => storagePath.startsWith(prefix));
}

export const MAX_ATTACHMENT_BYTES = 26214400;

export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'application/zip',
  'application/octet-stream',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/tiff',
] as const;

const allowed = new Set<string>(ALLOWED_ATTACHMENT_TYPES);

function megabytes(bytes: number): string {
  return `${Math.round((bytes / 1048576) * 10) / 10} MB`;
}

export function attachmentRejection(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name} is ${megabytes(file.size)}. The limit is ${megabytes(MAX_ATTACHMENT_BYTES)}.`;
  }
  const type = file.type || 'application/octet-stream';
  if (!allowed.has(type)) {
    return `${file.name} is a ${type} file, which cannot be attached. Documents, spreadsheets, plain text and photographs are accepted.`;
  }
  return null;
}
