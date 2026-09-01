import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './auth/SessionProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './shell/AppShell';
import { TaleoPlaceholderProvider } from './shell/TaleoPlaceholder';
import { DashboardPage } from './pages/DashboardPage';
import { RecruitRoutes } from './modules/recruit';
import { SalesRoutes } from './modules/sales';
import { IntakeRoutes } from './modules/intake';
import { SettingsRoutes } from './modules/settings';
import { ModulePlaceholderRoutes } from './pages/TaleoModulePlaceholderPage';

/**
 * Route map.
 *
 * Module mount points — replace the <Route path="recruit/*"> / "sales/*"
 * elements with your module's own <Routes> tree:
 *   - /recruit/*  → Agent 2 (ATS): requisitions, candidates, intake
 *   - /sales/*    → Agent 3 (CRM): companies, contacts, deals
 *
 * Role limits on the mounts mirror the section 5 matrix (bd has no ATS
 * access, sourcer has no CRM access). RLS remains the real boundary.
 */
export default function App() {
  return (
    <SessionProvider>
      <TaleoPlaceholderProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route
                path="recruit/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer']}>
                    <RecruitRoutes />
                  </RequireAuth>
                }
              />
              <Route
                path="sales/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'bd']}>
                    <SalesRoutes />
                  </RequireAuth>
                }
              />
              <Route
                path="intake/*"
                element={
                  // Shared across ATS and CRM (Agent 5): sourcers/recruiters
                  // work candidate rows, bd works contact rows. RLS on
                  // intake_items (section 5) is the real boundary; this list
                  // just keeps sourcer-only/bd-only staff from hitting a blank
                  // "not authorized" screen for a route that's genuinely
                  // cross-module rather than gating it to one side.
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <IntakeRoutes />
                  </RequireAuth>
                }
              />
              <Route
                path="settings/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <SettingsRoutes />
                  </RequireAuth>
                }
              />
              {/* Taleo primary-nav tabs FOOS doesn't implement yet
                  (Employees, Onboard/Offboard, Users, Courses) — real,
                  role-visible, screenshot-accurate static shells rather than
                  a 404. Reports reuses the dashboard route per the prompt
                  (section 8.10 / 8.1), so it isn't listed here. */}
              <Route
                path="employees/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <ModulePlaceholderRoutes module="employees" />
                  </RequireAuth>
                }
              />
              <Route
                path="onboard/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <ModulePlaceholderRoutes module="onboard" />
                  </RequireAuth>
                }
              />
              <Route
                path="users/*"
                element={
                  <RequireAuth roles={['admin']}>
                    <ModulePlaceholderRoutes module="users" />
                  </RequireAuth>
                }
              />
              <Route
                path="courses/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <ModulePlaceholderRoutes module="courses" />
                  </RequireAuth>
                }
              />
              <Route
                path="*"
                element={
                  <div className="stub-panel">
                    <h1>Page not found</h1>
                  </div>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </TaleoPlaceholderProvider>
    </SessionProvider>
  );
}
