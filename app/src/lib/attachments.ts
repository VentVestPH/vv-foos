const PENDING_PREFIXES = ['zoho-import/pending/', 'pending-file-export/'];

export const PENDING_FILE_LABEL = 'File not yet available';

export const PENDING_FILE_REASON =
  'This record came from the Zoho migration. The file itself has not been transferred yet, so there is nothing to open.';

export function isPendingFile(storagePath: string | null | undefined): boolean {
  if (!storagePath) return false;
  return PENDING_PREFIXES.some((prefix) => storagePath.startsWith(prefix));
}
