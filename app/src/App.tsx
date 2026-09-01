import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './auth/SessionProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './shell/AppShell';
import { TaleoPlaceholderProvider } from './shell/TaleoPlaceholder';
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const RecruitRoutes = lazy(() =>
  import('./modules/recruit').then((m) => ({ default: m.RecruitRoutes })),
);
const SalesRoutes = lazy(() =>
  import('./modules/sales').then((m) => ({ default: m.SalesRoutes })),
);
const IntakeRoutes = lazy(() =>
  import('./modules/intake').then((m) => ({ default: m.IntakeRoutes })),
);
const SettingsRoutes = lazy(() =>
  import('./modules/settings').then((m) => ({ default: m.SettingsRoutes })),
);
const ModulePlaceholderRoutes = lazy(() =>
  import('./pages/TaleoModulePlaceholderPage').then((m) => ({
    default: m.ModulePlaceholderRoutes,
  })),
);

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
/**
 * Route-level code splitting. Before this the whole application shipped as one
 * 652 kB chunk, so a bd user who cannot see the ATS still downloaded it, and the
 * login page downloaded every module. Each module is now its own chunk, fetched
 * when its route is first visited.
 *
 * The fallback is deliberately a plain inline line of text, not a spinner or a
 * skeleton. Redesign prompt section 9: "loading: small inline text or restrained
 * spinner; do not replace the page with a giant loader". It renders inside the
 * shell's content pane, so the header, nav and sidebar stay put and nothing
 * shifts.
 */
function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="full-center text-secondary">Loading...</div>}>
      {children}
    </Suspense>
  );
}

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
              <Route index element={
                  <Lazy>
                    <Lazy><DashboardPage /></Lazy>
                  </Lazy>
                } />
              <Route
                path="recruit/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer']}>
                    <Lazy><RecruitRoutes /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="sales/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'bd']}>
                    <Lazy><SalesRoutes /></Lazy>
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
                    <Lazy><IntakeRoutes /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="settings/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <Lazy><SettingsRoutes /></Lazy>
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
                    <Lazy><ModulePlaceholderRoutes module="employees" /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="onboard/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <Lazy><ModulePlaceholderRoutes module="onboard" /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="users/*"
                element={
                  <RequireAuth roles={['admin']}>
                    <Lazy><ModulePlaceholderRoutes module="users" /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="courses/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <Lazy><ModulePlaceholderRoutes module="courses" /></Lazy>
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
