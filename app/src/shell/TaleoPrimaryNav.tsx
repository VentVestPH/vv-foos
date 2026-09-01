import { useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '../auth/SessionProvider';
import { primaryNavForRole } from './navConfig';
import { HomeIcon } from './icons';

/**
 * Taleo primary horizontal nav (redesign prompt section 5.2): steel-blue
 * band, tabs in the exact specified order, active tab rendered as a
 * light-gray rectangle cut into the band (no pill, no underline). Home is
 * icon-only. Role filtering mirrors the original vertical nav's
 * sectionsForRole — RLS remains the real boundary.
 */
export function TaleoPrimaryNav() {
  const role = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const items = primaryNavForRole(role);

  return (
    <nav className="taleo-primary-nav" aria-label="Primary">
      {items.map((item) => {
        const active = item.isActive
          ? item.isActive(location.pathname, location.search)
          : location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to));
        return (
          <button
            key={item.label}
            type="button"
            className={
              'taleo-nav-tab' +
              (active ? ' active' : '') +
              (item.homeIcon ? ' taleo-nav-home' : '')
            }
            onClick={() => navigate(item.to)}
            aria-current={active ? 'page' : undefined}
            title={item.label}
          >
            {item.homeIcon ? <HomeIcon size={20} /> : item.label}
          </button>
        );
      })}
    </nav>
  );
}
