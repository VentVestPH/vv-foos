import { useEffect, useMemo, useState } from 'react';
import { fetchAllRows } from '../../lib/fetchAll';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../auth/SessionProvider';
import type { Company, Staff } from './lib';
import { EMPTY_CELL } from '../../lib/format';

let staffCache: Staff[] | null = null;
const COMPANY_OPTION_COLUMNS = 'id, name';

export type CompanyOption = Pick<Company, 'id' | 'name'>;

let companyCache: CompanyOption[] | null = null;

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
      id ? (byId.get(id) ?? EMPTY_CELL) : EMPTY_CELL,
    staffOptions: staff
      .filter((s) => s.is_active)
      .map((s) => ({ value: s.id, label: s.full_name })),
  };
}

export function useCompanyOptions(refreshKey = 0) {
  const [companies, setCompanies] = useState<CompanyOption[]>(companyCache ?? []);

  useEffect(() => {
    if (companyCache && refreshKey === 0) return;
    let cancelled = false;
    void fetchAllRows((f, t) =>
      supabase.from('companies').select(COMPANY_OPTION_COLUMNS).order('name').order('id').range(f, t),
    )
      .then((data) => {
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
      id ? (byId.get(id)?.name ?? EMPTY_CELL) : EMPTY_CELL,
    companyOptions: companies.map((c) => ({ value: c.id, label: c.name })),
  };
}

export function useCanEditCrm(): boolean {
  const role = useRole();
  return role === 'admin' || role === 'bd';
}

export interface ContactOption {
  value: string;
  label: string;
  companyId: string | null;
}

let contactCache: ContactOption[] | null = null;

export function useContactOptions() {
  const [contacts, setContacts] = useState<ContactOption[]>(contactCache ?? []);

  useEffect(() => {
    if (contactCache) return;
    let cancelled = false;
    void fetchAllRows((f, t) =>
      supabase
        .from('contact_list')
        .select('person_id, full_name, company_id, company_name')
        .order('last_name')
        .order('person_id')
        .range(f, t),
    ).then((rows) => {
      if (cancelled) return;
      contactCache = rows.map((row) => ({
        value: row.person_id,
        label: row.company_name
          ? `${row.full_name ?? 'Unnamed'} · ${row.company_name}`
          : (row.full_name ?? 'Unnamed'),
        companyId: row.company_id,
      }));
      setContacts(contactCache);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return contacts;
}
