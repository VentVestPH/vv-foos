import { useEffect, useMemo, useState } from 'react';
import { db as supabase } from './db';
import { useRole } from '../../auth/SessionProvider';
import type { Company, Staff } from './lib';

// Small lookup tables (12 staff, ~42 companies) cached per app session.
let staffCache: Staff[] | null = null;
let companyCache: Company[] | null = null;

/** All staff rows — readable by every role per the section 5 matrix. */
export function useStaffList() {
  const [staff, setStaff] = useState<Staff[]>(staffCache ?? []);

  useEffect(() => {
    if (staffCache) return;
    let cancelled = false;
    supabase
      .from('staff')
      .select('*')
      .order('full_name')
      .then(({ data }) => {
        if (!cancelled && data) {
          staffCache = data;
          setStaff(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(
    () => new Map(staff.map((s) => [s.id, s.full_name])),
    [staff],
  );

  return {
    staff,
    staffName: (id: string | null | undefined) =>
      id ? (byId.get(id) ?? '—') : '—',
    staffOptions: staff
      .filter((s) => s.is_active)
      .map((s) => ({ value: s.id, label: s.full_name })),
  };
}

/** Companies for pickers, cached. Pass refreshKey to force a reload. */
export function useCompanyOptions(refreshKey = 0) {
  const [companies, setCompanies] = useState<Company[]>(companyCache ?? []);

  useEffect(() => {
    if (companyCache && refreshKey === 0) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (!cancelled && data) {
          companyCache = data;
          setCompanies(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const byId = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );

  return {
    companies,
    companyName: (id: string | null | undefined) =>
      id ? (byId.get(id)?.name ?? '—') : '—',
    companyOptions: companies.map((c) => ({ value: c.id, label: c.name })),
  };
}

/**
 * Whether the current user can create/edit CRM records. Section 5 matrix:
 * admin and bd are full on companies/deals/contact_profiles; recruiter is
 * read-only; sourcer never reaches these routes. UI courtesy — RLS enforces.
 */
export function useCanEditCrm(): boolean {
  const role = useRole();
  return role === 'admin' || role === 'bd';
}
