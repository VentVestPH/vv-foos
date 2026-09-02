import { useCallback, useEffect, useRef, useState } from 'react';
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
  const navRef = useRef<HTMLElement>(null);
  const [overflowing, setOverflowing] = useState<'none' | 'start' | 'end' | 'both'>('none');

  const measure = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const slack = el.scrollWidth - el.clientWidth;
    if (slack <= 1) {
      setOverflowing('none');
      return;
    }
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft >= slack - 1;
    setOverflowing(atStart ? 'end' : atEnd ? 'start' : 'both');
  }, []);

  useEffect(() => {
    measure();
    const el = navRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure, items.length]);

  const scrollBy = (direction: -1 | 1) => {
    navRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });
  };

  return (
    <div className="fo-primary-nav-wrap" data-overflowing={overflowing}>
      <button
        type="button"
        className="fo-nav-scroll-btn"
        data-side="start"
        aria-label="Scroll the navigation left"
        onClick={() => scrollBy(-1)}
      >
        &lsaquo;
      </button>
      <button
        type="button"
        className="fo-nav-scroll-btn"
        data-side="end"
        aria-label="Scroll the navigation right"
        onClick={() => scrollBy(1)}
      >
        &rsaquo;
      </button>
    <nav className="fo-primary-nav" aria-label="Primary" ref={navRef}>
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
            {item.homeIcon ? (
              <HomeIcon size={20} />
            ) : (
              <span className="fo-nav-label" data-label={item.label}>
                <span>{item.label}</span>
              </span>
            )}
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
    </div>
  );
}
