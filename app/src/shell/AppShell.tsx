import { Outlet } from 'react-router-dom';
import { TaleoUtilityHeader } from './TaleoUtilityHeader';
import { TaleoPrimaryNav } from './TaleoPrimaryNav';
import { TaleoSidebar } from './TaleoSidebar';
import { BookmarkBar } from './BookmarkBar';
import { useStickyFocusGuard } from './useStickyFocusGuard';

export function AppShell() {
  useStickyFocusGuard();

  return (
    <div className="shell">
      <TaleoUtilityHeader />
      <TaleoPrimaryNav />
      <div className="taleo-body">
        <TaleoSidebar />
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
