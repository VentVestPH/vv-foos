import { BookmarkToggle } from './BookmarkBar';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { usePlaceholder } from './TaleoPlaceholder';
import { MegaphoneIcon, GearIcon, BarChartIcon } from './icons';

export function TaleoUtilityHeader() {
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
    <header className="taleo-utility-header">
      <div className="taleo-brand">
        <span className="taleo-brand-word">VENTVEST</span>
        <span className="taleo-brand-sub">Front Office OS</span>
      </div>

      <div className="taleo-utility-actions">
        <BookmarkToggle />
        <button
          type="button"
          className="taleo-utility-icon"
          aria-label="Announcements"
          title="Announcements"
          aria-disabled
          onClick={() => show('Announcements')}
        >
          <MegaphoneIcon />
        </button>
        <button
          type="button"
          className="taleo-utility-icon"
          aria-label="Settings"
          title="Settings"
          onClick={() => (window.location.href = '/settings')}
        >
          <GearIcon />
        </button>
        <button
          type="button"
          className="taleo-utility-icon"
          aria-label="Reports"
          title="Reports"
          onClick={() => (window.location.href = '/?tab=reports')}
        >
          <BarChartIcon />
        </button>

        <button
          type="button"
          className="taleo-utility-link"
          aria-disabled
          onClick={() => show('Web Support')}
        >
          Web Support
        </button>

        <div className="taleo-utility-menu-wrap" ref={adminRef}>
          <button
            type="button"
            className="taleo-utility-link"
            aria-haspopup="menu"
            aria-expanded={adminOpen}
            onClick={() => setAdminOpen((v) => !v)}
          >
            Administration <span className="taleo-utility-caret">▾</span>
          </button>
          {adminOpen && (
            <div className="taleo-utility-menu" role="menu">
              <a className="taleo-utility-menu-item" href="/settings" role="menuitem">
                Settings
              </a>
              <button
                type="button"
                className="taleo-utility-menu-item"
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
                className="taleo-utility-menu-item"
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

        <div className="taleo-utility-menu-wrap" ref={helpRef}>
          <button
            type="button"
            className="taleo-utility-link"
            aria-haspopup="menu"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
          >
            Help <span className="taleo-utility-caret">▾</span>
          </button>
          {helpOpen && (
            <div className="taleo-utility-menu" role="menu">
              <div className="taleo-utility-menu-item" style={{ cursor: 'default' }}>
                Signed in as {staff?.full_name ?? 'Account'}
              </div>
              <button
                type="button"
                className="taleo-utility-menu-item"
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

        <button type="button" className="taleo-logout" onClick={() => void signOut()}>
          Logout
        </button>
      </div>
    </header>
  );
}
