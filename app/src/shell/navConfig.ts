import type { StaffRole } from '../lib/database.types';

export interface PrimaryNavItem {
  label: string;
  to: string;
  /** Roles that see this tab. RLS remains the real boundary — this is UI
   *  courtesy only, per architecture section 5. */
  roles: StaffRole[];
  /** True for routes this tab should also be considered "active" on, beyond
   *  an exact/prefix match on `to` (e.g. Home/Pipeline both point at `/`
   *  but are distinguished by a query param). */
  isActive?: (pathname: string, search: string) => boolean;
  homeIcon?: boolean;
}

const ALL: StaffRole[] = ['admin', 'recruiter', 'sourcer', 'bd'];
const ATS: StaffRole[] = ['admin', 'recruiter', 'sourcer'];
const CRM: StaffRole[] = ['admin', 'recruiter', 'bd'];

/**
 * The Taleo primary horizontal nav, in the exact order the redesign prompt
 * specifies (section 5.2), with FOOS's own extensions (Deals, Tickets,
 * Intake) slotted in per its explicit placement rules — Deals/Tickets after
 * Contacts, Intake after Candidates. Settings is deliberately NOT a tab here
 * (prompt: reached via the utility-header gear + Administration menu).
 */
export const PRIMARY_NAV: PrimaryNavItem[] = [
  {
    label: 'Home',
    to: '/',
    roles: ALL,
    homeIcon: true,
    isActive: (pathname, search) =>
      pathname === '/' && !new URLSearchParams(search).get('tab'),
  },
  {
    label: 'Pipeline',
    to: '/?tab=pipeline',
    roles: ALL,
    isActive: (pathname, search) =>
      pathname === '/' && new URLSearchParams(search).get('tab') === 'pipeline',
  },
  { label: 'Requisitions', to: '/recruit/requisitions', roles: ATS },
  { label: 'Candidates', to: '/recruit/candidates', roles: ATS },
  { label: 'Intake', to: '/intake', roles: ALL },
  { label: 'Accounts', to: '/sales/companies', roles: CRM },
  { label: 'Contacts', to: '/sales/contacts', roles: CRM },
  { label: 'Deals', to: '/sales/deals', roles: CRM },
  { label: 'Tickets', to: '/sales/tickets', roles: CRM },
  { label: 'Employees', to: '/employees', roles: ALL },
  { label: 'Onboard/Offboard', to: '/onboard', roles: ALL },
  { label: 'Users', to: '/users', roles: ['admin'] },
  {
    label: 'Reports',
    to: '/?tab=reports',
    roles: ALL,
    isActive: (pathname, search) =>
      pathname === '/' && new URLSearchParams(search).get('tab') === 'reports',
  },
  { label: 'Courses', to: '/courses', roles: ALL },
];

export function primaryNavForRole(role: StaffRole | null): PrimaryNavItem[] {
  if (!role) return [];
  return PRIMARY_NAV.filter((item) => item.roles.includes(role));
}
