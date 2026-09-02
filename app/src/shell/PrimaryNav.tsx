import { useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '../auth/SessionProvider';
import { primaryNavForRole } from './navConfig';
import { House as HomeIcon } from 'lucide-react';
import { useIntakeBadge } from '../modules/intake';

export function PrimaryNav() {
  const role = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const items = primaryNavForRole(role);
  const intakeCount = useIntakeBadge();

  return (
    <nav className="fo-primary-nav" aria-label="Primary">
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
              'fo-nav-tab' +
              (active ? ' active' : '') +
              (item.homeIcon ? ' fo-nav-home' : '')
            }
            onClick={() => navigate(item.to)}
            aria-current={active ? 'page' : undefined}
            title={
              item.badge === 'intake' && intakeCount > 0
                ? `${item.label} (${intakeCount} awaiting review)`
                : item.label
            }
          >
            {item.homeIcon ? <HomeIcon size={20} /> : item.label}
            {item.badge === 'intake' ? (
              <span aria-live="polite" aria-atomic="true">
                {intakeCount > 0 ? (
                  <span className="fo-nav-badge">
                    {intakeCount}
                    <span className="visually-hidden"> items awaiting review</span>
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
