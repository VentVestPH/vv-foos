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
