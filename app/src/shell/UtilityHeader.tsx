import { BookmarkToggle } from './BookmarkBar';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { usePlaceholder } from './Placeholder';
import {
  ChartColumn as BarChartIcon,
  Megaphone as MegaphoneIcon,
  Settings as GearIcon,
} from 'lucide-react';

export function UtilityHeader() {
  const { staff, signOut } = useSession();
  const { show } = usePlaceholder();
  const [adminOpen, setAdminOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="fo-utility-header">
      <div className="fo-brand">
        <img
          className="fo-brand-logo"
          src="/ventvest-logo.webp"
          alt="VentVest"
          width={1038}
          height={231}
        />
        <span className="fo-brand-sub">Front Office OS</span>
      </div>

      <div className="fo-utility-actions">
        <BookmarkToggle />
        <button
          type="button"
          className="fo-utility-icon"
          aria-label="Announcements"
          title="Announcements"
          aria-disabled
          onClick={() => show('Announcements')}
        >
          <MegaphoneIcon />
        </button>
        <button
          type="button"
          className="fo-utility-icon"
          aria-label="Settings"
          title="Settings"
          onClick={() => (window.location.href = '/settings')}
        >
          <GearIcon />
        </button>
        <button
          type="button"
          className="fo-utility-icon"
          aria-label="Reports"
          title="Reports"
          onClick={() => (window.location.href = '/?tab=reports')}
        >
          <BarChartIcon />
        </button>

        <button
          type="button"
          className="fo-utility-link"
          aria-disabled
          onClick={() => show('Web Support')}
        >
          Web Support
        </button>

        <div className="fo-utility-menu-wrap" ref={adminRef}>
          <button
            type="button"
            className="fo-utility-link"
            aria-haspopup="menu"
            aria-expanded={adminOpen}
            onClick={() => setAdminOpen((v) => !v)}
          >
            Administration <span className="fo-utility-caret">▾</span>
          </button>
          {adminOpen && (
            <div className="fo-utility-menu" role="menu">
              <a className="fo-utility-menu-item" href="/settings" role="menuitem">
                Settings
              </a>
              <button
                type="button"
                className="fo-utility-menu-item"
                role="menuitem"
                aria-disabled
                onClick={() => {
                  setAdminOpen(false);
                  show('Administration', 'General configuration is not part of the FOOS MVP.');
                }}
              >
                General Configuration
              </button>
              <button
                type="button"
                className="fo-utility-menu-item"
                role="menuitem"
                aria-disabled
                onClick={() => {
                  setAdminOpen(false);
                  show('Administration', 'Career Section administration is not part of the FOOS MVP.');
                }}
              >
                Career Section
              </button>
            </div>
          )}
        </div>

        <div className="fo-utility-menu-wrap" ref={helpRef}>
          <button
            type="button"
            className="fo-utility-link"
            aria-haspopup="menu"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
          >
            Help <span className="fo-utility-caret">▾</span>
          </button>
          {helpOpen && (
            <div className="fo-utility-menu" role="menu">
              <div className="fo-utility-menu-item" style={{ cursor: 'default' }}>
                Signed in as {staff?.full_name ?? 'Account'}
              </div>
              <button
                type="button"
                className="fo-utility-menu-item"
                role="menuitem"
                aria-disabled
                onClick={() => {
                  setHelpOpen(false);
                  show('Help');
                }}
              >
                Online Help
              </button>
            </div>
          )}
        </div>

        <button type="button" className="fo-logout" onClick={() => void signOut()}>
          Logout
        </button>
      </div>
    </header>
  );
}
