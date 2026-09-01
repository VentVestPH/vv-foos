export type RelatedType = 'person' | 'company' | 'deal' | 'requisition' | 'application' | 'ticket';

const ROUTES: Record<string, (id: string) => string> = {
  person: (id) => `/recruit/candidates/${id}`,
  company: (id) => `/sales/companies/${id}`,
  deal: (id) => `/sales/deals/${id}`,
  requisition: (id) => `/recruit/requisitions/${id}`,
  application: (id) => `/recruit/candidates/${id}`,
};

export function relatedHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  const build = ROUTES[type];
  return build ? build(id) : null;
}

export function relatedLabel(type: string | null): string {
  if (!type) return 'Unlinked';
  return type.charAt(0).toUpperCase() + type.slice(1);
}
