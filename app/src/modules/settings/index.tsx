import { Route, Routes } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';

export function SettingsRoutes() {
  return (
    <Routes>
      <Route index element={<SettingsPage />} />
    </Routes>
  );
}
