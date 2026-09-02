export interface TemplateSubject {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  current_title?: string | null;
  current_employer?: string | null;
}

export const TEMPLATE_PLACEHOLDERS = [
  'first_name',
  'last_name',
  'full_name',
  'current_title',
  'current_employer',
] as const;

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export function applyTemplate(text: string, subject: TemplateSubject): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, rawName: string) => {
    const name = rawName.toLowerCase() as TemplatePlaceholder;
    if (!(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(name)) return whole;
    const value = subject[name];
    return value ? String(value) : '';
  });
}

export function unknownPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(name)) found.add(name);
  }
  return [...found];
}
