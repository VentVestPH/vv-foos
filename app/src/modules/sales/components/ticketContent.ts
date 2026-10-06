import { supabase } from '../../../lib/supabase';

export interface InlineImage {
  storage_path: string;
  url: string;
  name?: string;
}

export interface PendingFile {
  id: string;
  file: File;
  preview: string;
  inline: boolean;
}

export interface UploadedFile {
  pendingId: string;
  attachmentId: string;
  path: string;
  name: string;
}

const TICKET_FILE_LIMIT = 12;
const TICKET_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const TICKET_DESCRIPTION_MAX = 30000;
export const TICKET_COMMENT_MAX = 10000;

export const TICKET_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const TICKET_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const pad = (value: number) => String(value).padStart(2, '0');

export function localDueParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '17:00' };
  const due = new Date(iso);
  return {
    date: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`,
    time: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
  };
}

export function dueIso(date: string, time: string): string | null {
  return date ? new Date(`${date}T${time || '17:00'}`).toISOString() : null;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character
  ));
}

const MARKUP = /<(?:p|div|br|strong|b|em|i|u|s|ul|ol|li|a|img|blockquote|code|pre|h[1-6])\b/i;
const ALLOWED_TAGS = new Set([
  'P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'IMG',
  'BLOCKQUOTE', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
]);

function parseHtml(source: string): Document {
  return new DOMParser().parseFromString(source, 'text/html');
}

export function sanitizeTicketHtml(source: string | null, images: InlineImage[], fallbackAlt: string): string {
  if (!source || !source.trim()) return '';
  if (!MARKUP.test(source)) return `<p>${escapeHtml(source).replace(/\n/g, '<br>')}</p>`;
  const byPath = new Map(images.map((image) => [image.storage_path, image]));
  const parsed = parseHtml(source);
  const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_ELEMENT);
  const nodes: Element[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Element);
  for (const node of nodes.reverse()) {
    if (!ALLOWED_TAGS.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      continue;
    }
    const href = (node.getAttribute('href') ?? '').trim();
    const src = node.getAttribute('src') ?? '';
    const alt = node.getAttribute('alt') ?? '';
    const width = Number(node.getAttribute('width'));
    const height = Number(node.getAttribute('height'));
    for (const attribute of Array.from(node.attributes)) node.removeAttribute(attribute.name);
    if (node.tagName === 'A' && /^(https?:|mailto:)/i.test(href)) {
      node.setAttribute('href', href);
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noreferrer noopener');
    }
    if (node.tagName !== 'IMG') continue;
    const image = byPath.get(src);
    const url = image?.url ?? (/^https?:\/\//i.test(src) ? src : '');
    if (!url) {
      node.remove();
      continue;
    }
    const element = node as HTMLImageElement;
    element.setAttribute('src', url);
    element.setAttribute('alt', alt || image?.name || fallbackAlt);
    if (Number.isFinite(width) && width >= 80 && width <= 2000) {
      element.setAttribute('width', String(width));
      element.style.width = `${width}px`;
    }
    if (Number.isFinite(height) && height >= 48 && height <= 1600) {
      element.setAttribute('height', String(height));
      element.style.height = `${height}px`;
      element.style.maxHeight = 'none';
    }
  }
  return parsed.body.innerHTML;
}

export function htmlToText(source: string | null | undefined): string {
  if (!source) return '';
  if (!MARKUP.test(source)) return source.trim();
  return (parseHtml(source).body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function inlineImagePaths(source: string | null): Set<string> {
  if (!source || !/<img\b/i.test(source)) return new Set();
  return new Set(
    [...parseHtml(source).querySelectorAll('img')]
      .map((image) => image.getAttribute('src') ?? '')
      .filter(Boolean),
  );
}

export function htmlForStorage(source: string, uploaded: UploadedFile[], saved: InlineImage[]): string {
  if (!/<img\b/i.test(source)) return source.trim();
  const pathByPending = new Map(uploaded.map((file) => [file.pendingId, file.path]));
  const pathByUrl = new Map(saved.map((image) => [image.url, image.storage_path]));
  const parsed = parseHtml(source);
  parsed.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const pendingId = image.dataset.pendingId;
    if (pendingId) {
      const path = pathByPending.get(pendingId);
      if (path) {
        image.setAttribute('src', path);
        image.removeAttribute('data-pending-id');
      } else {
        image.remove();
      }
      return;
    }
    const path = pathByUrl.get(image.getAttribute('src') ?? '');
    if (path) image.setAttribute('src', path);
  });
  return parsed.body.innerHTML.trim();
}

export function referencedPendingIds(source: string): Set<string> {
  if (!/data-pending-id/.test(source)) return new Set();
  return new Set(
    [...parseHtml(source).querySelectorAll<HTMLImageElement>('img[data-pending-id]')]
      .map((image) => image.dataset.pendingId ?? '')
      .filter(Boolean),
  );
}

export function pendingImageMarkup(files: PendingFile[]): string {
  return files
    .filter((file) => file.inline)
    .map((file) => `<img src="${file.preview}" data-pending-id="${file.id}" alt="${escapeHtml(file.file.name)}">`)
    .join(' ');
}

function namedFile(file: File): File {
  if (file.name) return file;
  const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  return new File([file], `pasted-image-${Date.now()}.${extension}`, { type: file.type });
}

export function preparePendingFiles(
  files: File[],
  existingCount: number,
  inline: boolean,
): { added: PendingFile[]; error: string | null } {
  const room = Math.max(0, TICKET_FILE_LIMIT - existingCount);
  const oversized = files.some((file) => file.size > TICKET_FILE_MAX_BYTES);
  const added = files
    .filter((file) => file.size <= TICKET_FILE_MAX_BYTES)
    .slice(0, room)
    .map((raw) => {
      const file = namedFile(raw);
      const isImage = file.type.startsWith('image/');
      return {
        id: crypto.randomUUID(),
        file,
        preview: isImage ? URL.createObjectURL(file) : '',
        inline: inline && isImage,
      };
    });
  const error = oversized
    ? 'Each file must be 25 MB or smaller.'
    : files.length > room
      ? `You can attach up to ${TICKET_FILE_LIMIT} files at a time.`
      : null;
  return { added, error };
}

export function releasePreviews(files: PendingFile[]): void {
  for (const file of files) if (file.preview) URL.revokeObjectURL(file.preview);
}

export function validTicketUrl(raw: string, allowMailto: boolean): { url: string } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: 'Enter a link address.' };
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: 'Enter a valid web address, such as https://example.com.' };
  }
  const protocols = allowMailto ? ['http:', 'https:', 'mailto:'] : ['http:', 'https:'];
  if (!protocols.includes(parsed.protocol)) {
    return { error: allowMailto ? 'Use an https://, http://, or mailto: link.' : 'Use an https:// or http:// link.' };
  }
  if (parsed.protocol !== 'mailto:' && !parsed.hostname) {
    return { error: 'Enter a valid web address, such as https://example.com.' };
  }
  return { url: parsed.toString() };
}

export async function removeTicketFiles(files: Pick<UploadedFile, 'attachmentId' | 'path'>[]): Promise<string | null> {
  if (!files.length) return null;
  const { error: storageError } = await supabase.storage.from('attachments').remove(files.map((file) => file.path));
  if (storageError) return storageError.message;
  const { error: rowError } = await supabase.from('attachments').delete().in('id', files.map((file) => file.attachmentId));
  return rowError?.message ?? null;
}

export async function uploadTicketFiles(
  ticketId: string,
  folder: string,
  files: PendingFile[],
  staffId: string | null,
): Promise<{ uploaded: UploadedFile[]; errors: string[] }> {
  const results = await Promise.all(files.map(async (pending): Promise<UploadedFile | string> => {
    const safeName = pending.file.name.replace(/[^A-Za-z0-9._-]+/g, '_') || 'file';
    const path = `ticket/${ticketId}/${folder}/${pending.id}_${safeName}`;
    const attachmentId = crypto.randomUUID();
    const { error: rowError } = await supabase.from('attachments').insert({
      id: attachmentId,
      storage_path: path,
      parent_type: 'ticket',
      parent_id: ticketId,
      kind: 'other',
      description: pending.file.name,
      uploaded_by: staffId,
      file_size_bytes: pending.file.size,
    });
    if (rowError) return `${pending.file.name}: ${rowError.message}`;
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(path, pending.file, pending.file.type ? { contentType: pending.file.type } : {});
    if (uploadError) {
      await supabase.from('attachments').delete().eq('id', attachmentId);
      return `${pending.file.name}: ${uploadError.message}`;
    }
    return { pendingId: pending.id, attachmentId, path, name: pending.file.name };
  }));
  return {
    uploaded: results.filter((result): result is UploadedFile => typeof result !== 'string'),
    errors: results.filter((result): result is string => typeof result === 'string'),
  };
}

const SIGNED_URL_SECONDS = 3600;
const signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];
  for (const path of new Set(paths)) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expires > now) result.set(path, cached.url);
    else missing.push(path);
  }
  if (missing.length) {
    const { data } = await supabase.storage.from('attachments').createSignedUrls(missing, SIGNED_URL_SECONDS);
    const expires = now + (SIGNED_URL_SECONDS - 300) * 1000;
    for (const item of data ?? []) {
      if (!item.signedUrl || !item.path) continue;
      signedUrlCache.set(item.path, { url: item.signedUrl, expires });
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
}
