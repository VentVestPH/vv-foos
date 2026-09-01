import { useEffect, useRef, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { Input } from '../components/ui/Input';

/**
 * Top bar: global search stub plus the user menu. The search input records
 * intent only for now — Agent 7 wires it to real cross-entity search.
 */
export function TopBar() {
  const { staff, role, signOut } = useSession();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (staff?.full_name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, companies, requisitions… (coming soon)"
          aria-label="Global search"
        />
      </div>

      <div className="topbar-user" ref={menuRef}>
        <button
          type="button"
          className="topbar-user-button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="avatar">{initials}</span>
          <span>{staff?.full_name ?? 'Account'}</span>
        </button>
        {menuOpen && (
          <div className="user-menu" role="menu">
            <div className="user-menu-meta">
              <div>{staff?.email}</div>
              <div className="text-secondary">Role: {role ?? 'unknown'}</div>
            </div>
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
