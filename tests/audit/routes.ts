import { clientAs } from '../env';

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

export interface RouteSpec {
  id: string;
  path: string;
  area: string;
  needs?: 'requisition' | 'candidate' | 'company' | 'contact' | 'deal';
}

export const ROUTES: RouteSpec[] = [
  { id: 'dashboard-my-view', path: '/', area: 'dashboards' },
  { id: 'dashboard-pipeline', path: '/?tab=pipeline', area: 'dashboards' },
  { id: 'dashboard-reports', path: '/?tab=reports', area: 'dashboards' },
  { id: 'global-search', path: '/search?q=a', area: 'shell' },
  { id: 'recruit-candidates', path: '/recruit/candidates', area: 'recruit' },
  { id: 'recruit-candidate-record', path: '/recruit/candidates/:id', area: 'recruit', needs: 'candidate' },
  { id: 'recruit-requisitions', path: '/recruit/requisitions', area: 'recruit' },
  { id: 'recruit-requisition-new', path: '/recruit/requisitions/new', area: 'recruit' },
  { id: 'recruit-requisition-record', path: '/recruit/requisitions/:id', area: 'recruit', needs: 'requisition' },
  { id: 'recruit-requisition-edit', path: '/recruit/requisitions/:id/edit', area: 'recruit', needs: 'requisition' },
  { id: 'sales-companies', path: '/sales/companies', area: 'sales' },
  { id: 'sales-company-new', path: '/sales/companies/new', area: 'sales' },
  { id: 'sales-company-record', path: '/sales/companies/:id', area: 'sales', needs: 'company' },
  { id: 'sales-contacts', path: '/sales/contacts', area: 'sales' },
  { id: 'sales-contact-new', path: '/sales/contacts/new', area: 'sales' },
  { id: 'sales-contact-record', path: '/sales/contacts/:id', area: 'sales', needs: 'contact' },
  { id: 'sales-deals', path: '/sales/deals', area: 'sales' },
  { id: 'sales-deal-new', path: '/sales/deals/new', area: 'sales' },
  { id: 'sales-deal-record', path: '/sales/deals/:id', area: 'sales', needs: 'deal' },
  { id: 'sales-tickets', path: '/sales/tickets', area: 'sales' },
  { id: 'sales-promote', path: '/sales/promote', area: 'sales' },
  { id: 'intake-queue', path: '/intake', area: 'intake' },
  { id: 'intake-linkedin', path: '/intake/linkedin', area: 'intake' },
  { id: 'intake-sheet', path: '/intake/sheet', area: 'intake' },
  { id: 'not-found', path: '/a-path-that-does-not-exist', area: 'pages' },
  { id: 'not-found-intake', path: '/intake/a-path-that-does-not-exist', area: 'pages' },
  { id: 'settings', path: '/settings', area: 'settings' },
  { id: 'placeholder-employees', path: '/employees', area: 'pages' },
  { id: 'placeholder-onboard', path: '/onboard', area: 'pages' },
  { id: 'placeholder-users', path: '/users', area: 'pages' },
  { id: 'placeholder-courses', path: '/courses', area: 'pages' },
];

export async function resolveIds(): Promise<Record<string, string>> {
  const admin = await clientAs('admin');
  const ids: Record<string, string> = {};

  const req = await admin.from('requisitions').select('id').limit(1).single();
  if (req.error) throw new Error(`no requisition to audit: ${req.error.message}`);
  ids.requisition = req.data.id;

  const cand = await admin.from('candidate_profiles').select('person_id').limit(1).single();
  if (cand.error) throw new Error(`no candidate to audit: ${cand.error.message}`);
  ids.candidate = cand.data.person_id;

  const co = await admin.from('companies').select('id').limit(1).single();
  if (co.error) throw new Error(`no company to audit: ${co.error.message}`);
  ids.company = co.data.id;

  const contact = await admin.from('contact_profiles').select('person_id').limit(1).single();
  if (contact.error) throw new Error(`no contact to audit: ${contact.error.message}`);
  ids.contact = contact.data.person_id;

  const deal = await admin.from('deals').select('id').limit(1).single();
  if (!deal.error && deal.data) ids.deal = deal.data.id;

  return ids;
}

export function resolvePath(route: RouteSpec, ids: Record<string, string>): string | null {
  if (!route.needs) return route.path;
  const id = ids[route.needs];
  if (!id) return null;
  return route.path.replace(':id', id);
}
