// Agent 5 — sheet/Excel-from-URL fetch (instruction 5). Authenticated staff
// only (verify_jwt = true, the default). Fetches a Google Sheet URL or a
// hosted .xlsx/.csv URL, parses the header row, and returns the columns plus
// the full row set so the client can render a 10-row sample immediately and,
// after mapping, a full staged preview without a second fetch.
//
// Deploy: supabase functions deploy intake-sheet-fetch
// Request: POST { url: string }
// Response: { columns: string[], rows: Record<string,string>[], suggestedTemplateHint: string }

import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const MAX_ROWS = 500; // sane cap; a genuinely bigger import should be batched

// Called from the browser — needs a CORS preflight response or the request
// never leaves the browser ("Failed to fetch", found live during testing).
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

// Normalize a Google Sheets edit/view URL into its CSV export form.
// https://docs.google.com/spreadsheets/d/<id>/edit#gid=<gid>
//   -> https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>
// Already-published "pub?output=csv" links pass through untouched.
function normalizeSheetUrl(rawUrl: string): { url: string; hint: string } {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === "docs.google.com" && u.pathname.includes("/spreadsheets/")) {
      const idMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
      if (idMatch && !u.pathname.includes("/export") && !u.searchParams.has("output")) {
        const gid = u.hash.match(/gid=(\d+)/)?.[1] ?? u.searchParams.get("gid") ?? "0";
        return {
          url: `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`,
          hint: "Google Sheets",
        };
      }
      return { url: rawUrl, hint: "Google Sheets" };
    }
    return { url: rawUrl, hint: u.hostname };
  } catch {
    return { url: rawUrl, hint: "" };
  }
}

function parseCsv(text: string): string[][] {
  // Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes,
  // commas and newlines inside quotes. No external dependency needed for CSV.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.url) return json({ error: "url is required" }, 400);

  const { url: fetchUrl, hint } = normalizeSheetUrl(body.url);

  let res: Response;
  try {
    res = await fetch(fetchUrl);
  } catch (err) {
    return json({ error: `Could not fetch the URL: ${(err as Error).message}` }, 400);
  }
  if (!res.ok) {
    return json({ error: `Fetch failed with status ${res.status}` }, 400);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isXlsx =
    fetchUrl.toLowerCase().endsWith(".xlsx") ||
    contentType.includes("spreadsheetml") ||
    contentType.includes("officedocument");

  let table: string[][];
  if (isXlsx) {
    const buf = new Uint8Array(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    table = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as string[][];
  } else {
    const text = await res.text();
    table = parseCsv(text);
  }

  if (table.length === 0) {
    return json({ error: "The sheet has no rows" }, 400);
  }

  const header = table[0].map((h) => String(h ?? "").trim());
  const dataRows = table.slice(1, MAX_ROWS + 1);
  const rows = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((col, i) => {
      obj[col || `col_${i}`] = String(r[i] ?? "").trim();
    });
    return obj;
  });

  return json({
    columns: header.filter(Boolean),
    rows,
    truncated: dataRows.length > MAX_ROWS,
    suggestedTemplateHint: hint,
  });
});
