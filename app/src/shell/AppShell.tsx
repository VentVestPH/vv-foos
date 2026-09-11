import { Outlet, useLocation } from 'react-router-dom';
import { IdleSignOut } from '../auth/IdleSignOut';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { SectionCollapseProvider } from '../components/ui/SectionCollapse';
import { useScrollReset } from './useScrollReset';
import { UtilityHeader } from './UtilityHeader';
import { PrimaryNav } from './PrimaryNav';
import { ShellSidebar } from './ShellSidebar';
import { AdvancedSearchProvider } from './AdvancedSearch';
import { BookmarkBar } from './BookmarkBar';
import { useStickyFocusGuard } from './useStickyFocusGuard';

export function AppShell() {
  useStickyFocusGuard();
  useScrollReset();
  const location = useLocation();

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <UtilityHeader />
      <PrimaryNav />
      <AdvancedSearchProvider>
        <div className="fo-body">
          <ShellSidebar />
          <div className="shell-main">
            <main className="shell-content" id="main-content" tabIndex={-1}>
              <ErrorBoundary key={location.pathname} label="This page">
                <SectionCollapseProvider key={location.pathname}>
                  <Outlet />
                </SectionCollapseProvider>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </AdvancedSearchProvider>
      <BookmarkBar />
      <IdleSignOut />
    </div>
  );
}
