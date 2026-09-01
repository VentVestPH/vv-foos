// Intake module (Agent 5) entry point. Mount IntakeRoutes at /intake/* in
// App.tsx. Unlike ATS/CRM, this route is shared across both modules — the
// queue serves sourcers/recruiters (candidate rows) and bd (contact rows) —
// so it's a top-level mount, not nested under /recruit or /sales. RLS on
// intake_items (section 5) is what actually scopes each role's rows.

import { Route, Routes } from 'react-router-dom';
import './intake.css';
import { QueueListPage } from './QueueListPage';
import { LinkedInIntakePage } from './LinkedInIntakePage';
import { SheetImportPage } from './SheetImportPage';

export function IntakeRoutes() {
  return (
    <Routes>
      <Route index element={<QueueListPage />} />
      <Route path="linkedin" element={<LinkedInIntakePage />} />
      <Route path="sheet" element={<SheetImportPage />} />
      <Route
        path="*"
        element={
          <div className="stub-panel">
            <h1>Not found in Intake</h1>
          </div>
        }
      />
    </Routes>
  );
}

export { useIntakeBadge } from './hooks';
