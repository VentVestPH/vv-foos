import { Route, Routes } from 'react-router-dom';
import './intake.css';
import { QueueListPage } from './QueueListPage';
import { LinkedInIntakePage } from './LinkedInIntakePage';
import { SheetImportPage } from './SheetImportPage';
import { StubPanel } from '../../components/ui/StubPanel';

export function IntakeRoutes() {
  return (
    <Routes>
      <Route index element={<QueueListPage />} />
      <Route path="linkedin" element={<LinkedInIntakePage />} />
      <Route path="sheet" element={<SheetImportPage />} />
      <Route
        path="*"
        element={<StubPanel title="Not found in Intake" />}
      />
    </Routes>
  );
}

export { useIntakeBadge } from './hooks';
