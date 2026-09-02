import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { usePlaceholder } from './Placeholder';
import {
  ChevronLeft as ChevronLeftIcon,
  Search as SearchIcon,
  Settings as GearIcon,
  User as PersonIcon,
} from 'lucide-react';

export function ShellSidebar() {
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

    navigate(`/recruit/candidates?search=${encodeURIComponent(q)}`);
  };

  return (
    <aside
      className={collapsed ? 'fo-sidebar collapsed' : 'fo-sidebar'}
      aria-label="Quick search and recently viewed"
    >
      <div className="fo-sidebar-panel">
        <div className="fo-sidebar-panel-header">
          <span className="fo-sidebar-panel-title">Quick Search</span>
          <button
            type="button"
            className="fo-sidebar-collapse-btn"
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
        <form className="fo-sidebar-panel-body" onSubmit={runQuickSearch}>
          <div className="fo-qs-field">
            <span className="fo-qs-label">Candidate Keywords</span>
            <div className="fo-qs-input-row">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                aria-label="Candidate keywords"
              />
              <button
                type="submit"
                className="fo-qs-search-icon"
                aria-label="Search"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <SearchIcon size={16} />
              </button>
            </div>
          </div>
          <button
            type="button"
            className="fo-qs-advanced-link"
            aria-disabled
            onClick={() => show('Advanced Search')}
          >
            Advanced Search
          </button>
        </form>
      </div>

      <form className="fo-sidebar-card" onSubmit={runQuickSearch}>
          <div className="fo-qs-field">
            <span className="fo-qs-label">Candidate First Name</span>
            <div className="fo-qs-input-row">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-label="Candidate first name"
              />
              <SearchIcon size={16} className="fo-qs-search-icon" />
            </div>
          </div>
          <div className="fo-qs-field">
            <span className="fo-qs-label">Candidate Last Name</span>
            <div className="fo-qs-input-row">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-label="Candidate last name"
              />
            </div>
          </div>
      </form>

      <div className="fo-sidebar-panel">
        <div className="fo-sidebar-panel-header">
          <span className="fo-sidebar-panel-title">Recently Viewed</span>
          <button
            type="button"
            className="fo-sidebar-collapse-btn"
            aria-label="Configure Recently Viewed"
            title="Configure"
            aria-disabled
            onClick={() => show('Recently Viewed settings')}
          >
            <GearIcon size={14} />
          </button>
        </div>
        <div className="fo-sidebar-panel-body">
          {recent.length === 0 ? (
            <p className="fo-recent-empty">
              Records you open will appear here.
            </p>
          ) : (
            <div className="fo-recent-list">
              {recent.map((item) => (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  className="fo-recent-item"
                  onClick={() => item.href && navigate(item.href)}
                  title={item.label}
                >
                  <PersonIcon size={18} className="fo-recent-icon" />
                  <span className="fo-recent-text">
                    <span className="fo-recent-name">{item.label}</span>
                    <span className="fo-recent-type">{item.type}</span>
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
