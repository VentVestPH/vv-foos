// Settings module (Agent 6's connect/scope/disconnect surface, instruction
// 12). Single page for now — label picker and template manager are noted as
// follow-ups in the README, not part of this pass's critical path.

import { Route, Routes } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';

export function SettingsRoutes() {
  return (
    <Routes>
      <Route index element={<SettingsPage />} />
    </Routes>
  );
}
