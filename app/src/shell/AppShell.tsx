import { Outlet } from 'react-router-dom';
import { TaleoUtilityHeader } from './TaleoUtilityHeader';
import { TaleoPrimaryNav } from './TaleoPrimaryNav';
import { TaleoSidebar } from './TaleoSidebar';
import { useStickyFocusGuard } from './useStickyFocusGuard';

/**
 * TaleoAppShell (redesign prompt section 5): white utility header, steel-
 * blue primary nav, persistent left sidebar, light-gray main canvas. This
 * replaces the original dark vertical-nav shell entirely — see
 * TaleoUtilityHeader.tsx / TaleoPrimaryNav.tsx / TaleoSidebar.tsx for the
 * three pieces, and app.css's "Taleo replica shell" block for the styling.
 * Exported name kept as `AppShell` since App.tsx's route tree imports it
 * unchanged.
 */
export function AppShell() {
  // WCAG 2.2 SC 2.4.11: keep the sticky record action bar from completely
  // covering the keyboard-focused element. See useStickyFocusGuard.
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
