import { Outlet } from 'react-router-dom';
import { TaleoUtilityHeader } from './TaleoUtilityHeader';
import { TaleoPrimaryNav } from './TaleoPrimaryNav';
import { TaleoSidebar } from './TaleoSidebar';
import { useStickyFocusGuard } from './useStickyFocusGuard';

/**
 * Taleo shell: white utility header, steel-blue primary nav, persistent left
 * sidebar, light-gray canvas. Name kept as AppShell so App.tsx is unchanged.
 */
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
    </div>
  );
}
