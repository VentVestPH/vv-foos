import { Suspense, lazy, type ReactNode } from 'react';
import { RouteSkeleton } from './components/ui/PageSkeleton';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './auth/SessionProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './shell/AppShell';
import { PlaceholderProvider } from './shell/Placeholder';
import { StubPanel } from './components/ui/StubPanel';
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
const GlobalSearchPage = lazy(() =>
  import('./pages/GlobalSearchPage').then((m) => ({ default: m.GlobalSearchPage })),
);
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })),
);

const WorkforceRoutes = lazy(() =>
  import('./pages/WorkforcePage').then((m) => ({
    default: m.WorkforceRoutes,
  })),
);

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteSkeleton />}>
      {children}
    </Suspense>
  );
}

const SHORT_PATHS: [string, string][] = [
  ['requisitions', '/recruit/requisitions'],
  ['candidates', '/recruit/candidates'],
  ['deals', '/sales/deals'],
  ['contacts', '/sales/contacts'],
  ['companies', '/sales/companies'],
  ['accounts', '/sales/companies'],
  ['tickets', '/sales/tickets'],
];

export default function App() {
  return (
    <SessionProvider>
      <PlaceholderProvider>
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
              <Route index element={<Lazy><DashboardPage /></Lazy>} />
              <Route path="pipeline" element={<Lazy><DashboardPage view="pipeline" /></Lazy>} />
              <Route path="reports" element={<Lazy><DashboardPage view="reports" /></Lazy>} />
              <Route
                path="search"
                element={
                  <RequireAuth>
                    <Lazy><GlobalSearchPage /></Lazy>
                  </RequireAuth>
                }
              />
              {SHORT_PATHS.map(([short, full]) => (
                <Route key={short} path={short} element={<Navigate to={full} replace />} />
              ))}
              <Route
                path="recruit/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer']} deniedLabel="Recruiting">
                    <Lazy><RecruitRoutes /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="sales/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'bd']} deniedLabel="Sales">
                    <Lazy><SalesRoutes /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="intake/*"
                element={
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
              <Route
                path="employees/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <Lazy><WorkforceRoutes module="employees" /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="onboard/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <Lazy><WorkforceRoutes module="onboard" /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="users/*"
                element={
                  <RequireAuth roles={['admin']} deniedLabel="Users">
                    <Lazy><UsersPage /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="courses/*"
                element={
                  <RequireAuth roles={['admin', 'recruiter', 'sourcer', 'bd']}>
                    <Lazy><WorkforceRoutes module="courses" /></Lazy>
                  </RequireAuth>
                }
              />
              <Route
                path="*"
                element={<StubPanel title="Page not found" />}
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </PlaceholderProvider>
    </SessionProvider>
  );
}
