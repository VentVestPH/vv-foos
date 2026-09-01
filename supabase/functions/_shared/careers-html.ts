// Shared rendering helpers for the careers Edge Functions.
// Deno runtime (Supabase Edge Functions) — no npm deps.
//
// Colors below mirror app/src/styles/tokens.css (architecture doc section 7)
// verbatim. This is a separate, unauthenticated rendering surface from the
// Vite app, so the values are duplicated rather than imported — if the
// tokens change, update both files in the same commit.

export function escapeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildSlug(title: string, displayCode: string): string {
  return `${slugify(title)}-${displayCode.toLowerCase()}`;
}

// Recover the display_code (e.g. "REQ-0007") from a slug like
// "senior-data-engineer-req-0007". The code is always the trailing token.
export function displayCodeFromSlug(slug: string): string | null {
  const match = slug.match(/(req-\d+)$/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

const TOKENS_CSS = `
  :root {
    --primary: #2563EB; --primary-deep: #1E40AF; --slate: #334E68;
    --surface: #FFFFFF; --canvas: #F4F6F8; --section-tint: #EAF1F8;
    --success: #16A34A; --warning: #D97706; --danger: #DC2626;
    --text: #1F2937; --text-secondary: #6B7280; --border: #E5E7EB;
    --radius: 6px; --shadow: 0 1px 2px rgba(0,0,0,.05);
    --font: 'Inter', 'Roboto', system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: var(--font); color: var(--text);
    background: var(--canvas); font-size: 14px; line-height: 1.5;
  }
  a { color: var(--primary); }
  header.site {
    background: var(--slate); color: #fff; padding: 24px 16px;
  }
  header.site h1 { margin: 0; font-size: 20px; font-weight: 600; }
  header.site p { margin: 4px 0 0; color: #cbd5e1; font-size: 13px; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 16px; margin-bottom: 16px;
  }
  .card h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
  .meta { color: var(--text-secondary); font-size: 13px; margin: 0 0 8px; }
  .excerpt { margin: 0; }
  .btn {
    display: inline-block; background: var(--primary); color: #fff;
    padding: 10px 16px; border-radius: var(--radius); text-decoration: none;
    font-weight: 600; border: none; cursor: pointer; font-size: 14px;
  }
  .btn:hover { background: var(--primary-deep); }
  .btn:disabled { background: var(--border); cursor: not-allowed; }
  form.apply { margin-top: 24px; }
  label { display: block; font-weight: 600; margin: 12px 0 4px; font-size: 13px; }
  input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="file"] {
    width: 100%; padding: 10px; border: 1px solid var(--border);
    border-radius: var(--radius); font-size: 14px; font-family: var(--font);
  }
  .required { color: var(--danger); }
  .error { color: var(--danger); font-size: 13px; margin-top: 4px; display: none; }
  .consent-row { display: flex; align-items: flex-start; gap: 8px; margin-top: 16px; }
  .consent-row input { width: auto; margin-top: 3px; }
  .honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .search-row { display: flex; gap: 8px; margin-bottom: 16px; }
  .search-row input, .search-row select {
    padding: 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px;
  }
  .closed-notice { padding: 24px; text-align: center; }
  footer.site { text-align: center; color: var(--text-secondary); font-size: 12px; padding: 24px 16px; }
  #confirm { display: none; }
`;

export function renderPage(opts: {
  title: string;
  description: string;
  canonicalUrl: string;
  structuredData?: Record<string, unknown>;
  bodyHtml: string;
}): string {
  const { title, description, canonicalUrl, structuredData, bodyHtml } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta name="robots" content="index, follow" />
${
  structuredData
    ? `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`
    : ""
}
<style>${TOKENS_CSS}</style>
</head>
<body>
<header class="site">
  <h1>VentVest Careers</h1>
  <p>Open roles at VentVest and our client companies</p>
</header>
<main>
${bodyHtml}
</main>
<footer class="site">VentVest &middot; <a href="/careers-page">All open roles</a></footer>
</body>
</html>`;
}

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
