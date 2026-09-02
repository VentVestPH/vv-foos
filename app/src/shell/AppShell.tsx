import { Outlet } from 'react-router-dom';
import { UtilityHeader } from './UtilityHeader';
import { PrimaryNav } from './PrimaryNav';
import { ShellSidebar } from './ShellSidebar';
import { BookmarkBar } from './BookmarkBar';
import { useStickyFocusGuard } from './useStickyFocusGuard';

export function AppShell() {
  useStickyFocusGuard();

  return (
    <div className="shell">
      <UtilityHeader />
      <PrimaryNav />
      <div className="fo-body">
        <ShellSidebar />
        <div className="shell-main">
          <main className="shell-content">
            <Outlet />
          </main>
        </div>
      </div>
      <BookmarkBar />
    </div>
  );
}
