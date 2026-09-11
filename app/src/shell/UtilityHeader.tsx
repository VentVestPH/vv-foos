import { BookmarkToggle } from './BookmarkBar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { usePlaceholder } from './Placeholder';
import { useDismissable } from '../hooks/useDismissable';
import { useMenuKeyboard } from '../hooks/useMenuKeyboard';
import { SearchBox } from '../components/ui/SearchBox';
import { globalSearchHints } from '../lib/searchHints';
import {
  ChevronDown,
  ChartColumn as BarChartIcon,
  Megaphone as MegaphoneIcon,
  Settings as GearIcon,
} from 'lucide-react';
import { useScrollShadow } from '../hooks/useScrollShadow';

export function UtilityHeader() {
  const [topSearch, setTopSearch] = useState('');
  const { staff, signOut } = useSession();
  const navigate = useNavigate();
  const { show } = usePlaceholder();
  const [adminOpen, setAdminOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const closeAdmin = useCallback(() => setAdminOpen(false), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const admin = useDismissable(adminOpen, closeAdmin, adminRef);
  const help = useDismissable(helpOpen, closeHelp, helpRef);
  const adminKeys = useMenuKeyboard(adminOpen, closeAdmin, adminRef);
  const helpKeys = useMenuKeyboard(helpOpen, closeHelp, helpRef);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        adminRequestClose.current();
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        helpRequestClose.current();
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const adminShadow = useScrollShadow<HTMLDivElement>();
  const helpShadow = useScrollShadow<HTMLDivElement>();
  const adminRequestClose = useRef(admin.requestClose);
  const helpRequestClose = useRef(help.requestClose);
  adminRequestClose.current = admin.requestClose;
  helpRequestClose.current = help.requestClose;

  return (
    <header className="fo-utility-header">
      <Link className="fo-brand" to="/" aria-label="VentVest Front Office OS home">
        <img
          className="fo-brand-logo"
          src="/ventvest-logo.webp"
          alt="VentVest"
          width={1038}
          height={231}
        />
        <span className="fo-brand-sub">Front Office OS</span>
      </Link>

      <SearchBox
        className="fo-utility-search"
        value={topSearch}
        onValueChange={setTopSearch}
        ariaLabel="Search all records"
        placeholder="Search everything"
        fetchHints={globalSearchHints}
        onClear={() => setTopSearch('')}
      />

      <div className="fo-utility-actions">
        <BookmarkToggle />
        <button
          type="button"
          className="fo-utility-icon is-placeholder"
          aria-label="Announcements"
          title="Announcements"
          onClick={() => show('Announcements')}
        >
          <MegaphoneIcon />
        </button>
        <button
          type="button"
          className="fo-utility-icon"
          aria-label="Settings"
          title="Settings"
          onClick={() => navigate('/settings')}
        >
          <GearIcon />
        </button>
        <button
          type="button"
          className="fo-utility-icon"
          aria-label="Reports"
          title="Reports"
          onClick={() => navigate('/reports')}
        >
          <BarChartIcon />
        </button>

        <button
          type="button"
          className="fo-utility-link is-placeholder"
          onClick={() => show('Web Support')}
        >
          Web Support
        </button>

        <div className="fo-utility-menu-wrap" ref={adminRef} onKeyDown={adminKeys}>
          <button
            type="button"
            className="fo-utility-link is-placeholder"
            aria-haspopup="menu"
            aria-expanded={adminOpen}
            onClick={() => (adminOpen ? admin.requestClose() : setAdminOpen(true))}
          >
            Administration <span className="fo-utility-caret" aria-hidden="true">
              <ChevronDown size={20} />
            </span>
          </button>
          {adminOpen && (
            <div
              className="fo-utility-menu fo-scroll-shade"
              ref={adminShadow}
              data-closing={admin.closing ? 'true' : undefined}
              role="menu"
            >
              <a className="fo-utility-menu-item is-placeholder" href="/settings" role="menuitem">
                Settings
              </a>
              <button
                type="button"
                className="fo-utility-menu-item is-placeholder"
                role="menuitem"
                onClick={() => {
                  setAdminOpen(false);
                  show('General configuration');
                }}
              >
                General Configuration
              </button>
              <button
                type="button"
                className="fo-utility-menu-item is-placeholder"
                role="menuitem"
                onClick={() => {
                  setAdminOpen(false);
                  show('Career section administration');
                }}
              >
                Career Section
              </button>
            </div>
          )}
        </div>

        <div className="fo-utility-menu-wrap" ref={helpRef} onKeyDown={helpKeys}>
          <button
            type="button"
            className="fo-utility-link is-placeholder"
            aria-haspopup="menu"
            aria-expanded={helpOpen}
            onClick={() => (helpOpen ? help.requestClose() : setHelpOpen(true))}
          >
            Help <span className="fo-utility-caret" aria-hidden="true">
              <ChevronDown size={20} />
            </span>
          </button>
          {helpOpen && (
            <div
              className="fo-utility-menu fo-scroll-shade"
              ref={helpShadow}
              data-closing={help.closing ? 'true' : undefined}
              role="menu"
            >
              <div className="fo-utility-menu-item is-placeholder">
                Signed in as {staff?.full_name ?? 'Account'}
              </div>
              <button
                type="button"
                className="fo-utility-menu-item is-placeholder"
                role="menuitem"
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
