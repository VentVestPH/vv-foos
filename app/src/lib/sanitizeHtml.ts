const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BR',
  'DIV',
  'EM',
  'I',
  'LI',
  'OL',
  'P',
  'S',
  'SPAN',
  'STRONG',
  'U',
  'UL',
]);

const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

function clean(node: Node, out: Node, doc: Document): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      clean(el, out, doc);
      return;
    }
    const copy = doc.createElement(el.tagName.toLowerCase());
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (SAFE_HREF.test(href)) {
        copy.setAttribute('href', href);
        copy.setAttribute('rel', 'noopener noreferrer');
        copy.setAttribute('target', '_blank');
      }
    }
    clean(el, copy, doc);
    out.appendChild(copy);
  });
}

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const host = parsed.createElement('div');
  clean(parsed.body, host, parsed);
  return host.innerHTML;
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}
