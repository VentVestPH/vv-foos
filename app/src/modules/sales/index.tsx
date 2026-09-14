import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RouteSkeleton } from '../../components/ui/PageSkeleton';
import type { StaffRole } from '../../lib/database.types';
import './sales.css';
import { HiredPromotionListener } from './components/HiredPromotionListener';
import { CompaniesListPage } from './pages/CompaniesListPage';
import { CompanyNewPage } from './pages/CompanyNewPage';
import { CompanyRecordPage } from './pages/CompanyRecordPage';
import { ContactsListPage } from './pages/ContactsListPage';
import { ContactNewPage } from './pages/ContactNewPage';
import { DealsListPage } from './pages/DealsListPage';
import { DealNewPage } from './pages/DealNewPage';
import { DealRecordPage } from './pages/DealRecordPage';
import { TicketsListPage } from './pages/TicketsListPage';
import { PromoteContactPage } from './pages/PromoteContactPage';

export interface SalesNavItem {
  label: string;
  href: string;
  roles: StaffRole[];
}

const CRM_ROLES: StaffRole[] = ['admin', 'recruiter', 'bd'];

export const salesNavItems: SalesNavItem[] = [
  { label: 'Accounts', href: '/sales/companies', roles: CRM_ROLES },
  { label: 'Contacts', href: '/sales/contacts', roles: CRM_ROLES },
  { label: 'Deals', href: '/sales/deals', roles: CRM_ROLES },
  { label: 'Tickets', href: '/sales/tickets', roles: CRM_ROLES },
];

const ContactRecordPage = lazy(() =>
  import('./pages/ContactRecordPage').then((m) => ({ default: m.ContactRecordPage })),
);

export function SalesRoutes() {
  return (
    <>
      <HiredPromotionListener />
      <Routes>
        <Route index element={<Navigate to="deals" replace />} />
        <Route path="companies" element={<CompaniesListPage />} />
        <Route path="companies/new" element={<CompanyNewPage />} />
        <Route path="companies/:id" element={<CompanyRecordPage />} />
        <Route path="contacts" element={<ContactsListPage />} />
        <Route path="contacts/new" element={<ContactNewPage />} />
        <Route
          path="contacts/:personId"
          element={
            <Suspense fallback={<RouteSkeleton />}>
              <ContactRecordPage />
            </Suspense>
          }
        />
        <Route path="deals" element={<DealsListPage />} />
        <Route path="deals/new" element={<DealNewPage />} />
        <Route path="deals/:id" element={<DealRecordPage />} />
        <Route path="tickets" element={<TicketsListPage />} />
        <Route path="promote" element={<PromoteContactPage />} />
        <Route
          path="*"
          element={
            <div className="stub-panel">
              <h1>Page not found</h1>
            </div>
          }
        />
      </Routes>
    </>
  );
}
