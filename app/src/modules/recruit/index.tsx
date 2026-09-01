import { Navigate, Route, Routes } from 'react-router-dom';
import type { StaffRole } from '../../lib/database.types';
import './recruit.css';
import { RequisitionListPage } from './requisitions/RequisitionListPage';
import { RequisitionFormPage } from './requisitions/RequisitionFormPage';
import { RequisitionRecordPage } from './requisitions/RequisitionRecordPage';
import { CandidateListPage } from './candidates/CandidateListPage';
import { CandidateRecordPage } from './candidates/CandidateRecordPage';

export function RecruitRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="requisitions" replace />} />
      <Route path="requisitions" element={<RequisitionListPage />} />
      <Route path="requisitions/new" element={<RequisitionFormPage />} />
      <Route path="requisitions/:id" element={<RequisitionRecordPage />} />
      <Route path="requisitions/:id/edit" element={<RequisitionFormPage />} />
      <Route path="candidates" element={<CandidateListPage />} />
      <Route path="candidates/:id" element={<CandidateRecordPage />} />
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
