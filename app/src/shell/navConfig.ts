import type { StaffRole } from '../lib/database.types';

export interface PrimaryNavItem {
  label: string;
  to: string;

  roles: StaffRole[];

  isActive?: (pathname: string, search: string) => boolean;
  homeIcon?: boolean;
}

const ALL: StaffRole[] = ['admin', 'recruiter', 'sourcer', 'bd'];
const ATS: StaffRole[] = ['admin', 'recruiter', 'sourcer'];
const CRM: StaffRole[] = ['admin', 'recruiter', 'bd'];

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
