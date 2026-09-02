import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './auth/SessionProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { AppShell } from './shell/AppShell';
import { PlaceholderProvider } from './shell/Placeholder';
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
const ModulePlaceholderRoutes = lazy(() =>
  import('./pages/ModulePlaceholderPage').then((m) => ({
    default: m.ModulePlaceholderRoutes,
  })),
);

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
              <Route
                path="search"
                element={
                  <RequireAuth>
                    <Lazy><GlobalSearchPage /></Lazy>
                  </RequireAuth>
                }
              />
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
              {}
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
      </PlaceholderProvider>
    </SessionProvider>
  );
}
