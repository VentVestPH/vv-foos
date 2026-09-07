const ENCODED_WORD = /=\?([A-Za-z0-9_.:*+-]+)\?([BbQq])\?([^?]*)\?=/g;
const ADJACENT_GAP = /(\?=)[ \t]*(?:\r?\n[ \t]+)?(=\?)/g;

function base64ToBytes(text: string): Uint8Array | null {
  const cleaned = text.replace(/\s+/g, '');
  try {
    const binary = atob(cleaned);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function quotedPrintableToBytes(text: string): Uint8Array | null {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (ch === '_') {
      out.push(0x20);
      continue;
    }
    if (ch === '=') {
      const hex = text.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) return null;
      out.push(parseInt(hex, 16));
      i += 2;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code > 0xff) return null;
    out.push(code);
  }
  return new Uint8Array(out);
}

function decodeBytes(bytes: Uint8Array, charset: string): string | null {
  const label = charset.toLowerCase().replace(/\*.*$/, '');
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function decodeMimeHeader(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!value.includes('=?')) return value;

  let touched = false;
  const decoded = value
    .replace(ADJACENT_GAP, '$1$2')
    .replace(ENCODED_WORD, (whole, charset: string, encoding: string, text: string) => {
      const bytes = encoding.toUpperCase() === 'B' ? base64ToBytes(text) : quotedPrintableToBytes(text);
      if (!bytes) return whole;
      const out = decodeBytes(bytes, charset);
      if (out === null) return whole;
      touched = true;
      return out;
    });

  return touched ? decoded : value;
}
