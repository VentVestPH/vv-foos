import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RouteSkeleton } from '../../components/ui/PageSkeleton';
import type { StaffRole } from '../../lib/database.types';
import './recruit.css';
import { RequisitionListPage } from './requisitions/RequisitionListPage';
import { CandidateListPage } from './candidates/CandidateListPage';

const RequisitionFormPage = lazy(() =>
  import('./requisitions/RequisitionFormPage').then((m) => ({ default: m.RequisitionFormPage })),
);

const RequisitionRecordPage = lazy(() =>
  import('./requisitions/RequisitionRecordPage').then((m) => ({
    default: m.RequisitionRecordPage,
  })),
);

const CandidateRecordPage = lazy(() =>
  import('./candidates/CandidateRecordPage').then((m) => ({ default: m.CandidateRecordPage })),
);

export function RecruitRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="requisitions" replace />} />
      <Route path="requisitions" element={<RequisitionListPage />} />
      <Route
        path="requisitions/new"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <RequisitionFormPage />
          </Suspense>
        }
      />
      <Route
        path="requisitions/:id"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <RequisitionRecordPage />
          </Suspense>
        }
      />
      <Route
        path="requisitions/:id/edit"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <RequisitionFormPage />
          </Suspense>
        }
      />
      <Route path="candidates" element={<CandidateListPage />} />
      <Route
        path="candidates/:id"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <CandidateRecordPage />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <div className="stub-panel">
            <h1>Not found in Recruit</h1>
          </div>
        }
      />
    </Routes>
  );
}

export interface RecruitNavItem {
  label: string;
  href: string;
  roles: StaffRole[];
}

export const recruitNavItems: RecruitNavItem[] = [
  {
    label: 'Requisitions',
    href: '/recruit/requisitions',
    roles: ['admin', 'recruiter', 'sourcer'],
  },
  {
    label: 'Candidates',
    href: '/recruit/candidates',
    roles: ['admin', 'recruiter', 'sourcer'],
  },
];
