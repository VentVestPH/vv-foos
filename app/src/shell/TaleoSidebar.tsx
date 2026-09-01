import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { usePlaceholder } from './TaleoPlaceholder';
import { ChevronLeftIcon, SearchIcon, PersonIcon, GearIcon } from './icons';

/**
 * Persistent left sidebar (redesign prompt section 5.3): Quick Search panel
 * over a Recently Viewed panel, both with the steel-blue header band.
 * Expanded is the default state; collapse just narrows the rail (content
 * hides via CSS) rather than unmounting anything, so state isn't lost.
 */
export function TaleoSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const { items: recent } = useRecentlyViewed();
  const { show } = usePlaceholder();
  const navigate = useNavigate();

  const runQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keywords || [firstName, lastName].filter(Boolean).join(' ');
    if (!q.trim()) return;
    // Real, working connection to the existing candidate list + its
    // already-implemented search/filter behavior (prompt: "connect quick
    // search to existing candidate navigation/filtering when practical").
    navigate(`/recruit/candidates?search=${encodeURIComponent(q)}`);
  };

  return (
    <aside className={collapsed ? 'taleo-sidebar collapsed' : 'taleo-sidebar'}>
      <div className="taleo-sidebar-panel">
        <div className="taleo-sidebar-panel-header">
          <span className="taleo-sidebar-panel-title">Quick Search</span>
          <button
            type="button"
            className="taleo-sidebar-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeftIcon
              size={14}
              style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
            />
          </button>
        </div>
        <form className="taleo-sidebar-panel-body" onSubmit={runQuickSearch}>
          <div className="taleo-qs-field">
            <span className="taleo-qs-label">Candidate Keywords</span>
            <div className="taleo-qs-input-row">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                aria-label="Candidate keywords"
              />
              <button
                type="submit"
                className="taleo-qs-search-icon"
                aria-label="Search"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <SearchIcon size={16} />
              </button>
            </div>
          </div>
          <button
            type="button"
            className="taleo-qs-advanced-link"
            aria-disabled
            onClick={() => show('Advanced Search')}
          >
            Advanced Search
          </button>
          <hr className="taleo-qs-divider" />
          <div className="taleo-qs-field">
            <span className="taleo-qs-label">Candidate First Name</span>
            <div className="taleo-qs-input-row">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-label="Candidate first name"
              />
              <SearchIcon size={16} className="taleo-qs-search-icon" />
            </div>
          </div>
          <div className="taleo-qs-field">
            <span className="taleo-qs-label">Candidate Last Name</span>
            <div className="taleo-qs-input-row">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-label="Candidate last name"
              />
            </div>
          </div>
        </form>
      </div>

      <div className="taleo-sidebar-panel">
        <div className="taleo-sidebar-panel-header">
          <span className="taleo-sidebar-panel-title">Recently Viewed</span>
          <button
            type="button"
            className="taleo-sidebar-collapse-btn"
            aria-label="Configure Recently Viewed"
            title="Configure"
            aria-disabled
            onClick={() => show('Recently Viewed settings')}
          >
            <GearIcon size={14} />
          </button>
        </div>
        <div className="taleo-sidebar-panel-body">
          {recent.length === 0 ? (
            <p className="taleo-recent-empty">
              Records you open will appear here.
            </p>
          ) : (
            <div className="taleo-recent-list">
              {recent.map((item) => (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  className="taleo-recent-item"
                  onClick={() => item.href && navigate(item.href)}
                  title={item.label}
                >
                  <PersonIcon size={18} className="taleo-recent-icon" />
                  <span className="taleo-recent-text">
                    <span className="taleo-recent-name">{item.label}</span>
                    <span className="taleo-recent-type">{item.type}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
