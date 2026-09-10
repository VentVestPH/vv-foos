import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useDismissable } from '../hooks/useDismissable';
import { useOutsideClose } from '../hooks/useOutsideClose';
import { useAdvancedSearch } from './AdvancedSearch';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Briefcase as RequisitionIcon,
  Building2 as CompanyIcon,
  ChevronLeft as ChevronLeftIcon,
  Contact as ContactIcon,
  FileText as RecordIcon,
  History as HistoryIcon,
  Handshake as DealIcon,
  Search as SearchIcon,
  Settings as GearIcon,
  User as PersonIcon,
} from 'lucide-react';
import { useScrollShadow } from '../hooks/useScrollShadow';
import { sentenceCase } from '../lib/format';

const RECENT_ICONS: Record<string, typeof PersonIcon> = {
  requisition: RequisitionIcon,
  candidate: PersonIcon,
  company: CompanyIcon,
  contact: ContactIcon,
  deal: DealIcon,
};

interface SearchScope {
  noun: string;
  to: string;
  namedFields: boolean;
}

const SCOPES: Array<[RegExp, SearchScope]> = [
  [/^\/recruit\/requisitions/, { noun: 'Requisition', to: '/recruit/requisitions', namedFields: false }],
  [/^\/recruit/, { noun: 'Candidate', to: '/recruit/candidates', namedFields: true }],
  [/^\/sales\/companies/, { noun: 'Account', to: '/sales/companies', namedFields: false }],
  [/^\/sales\/deals/, { noun: 'Deal', to: '/sales/deals', namedFields: false }],
  [/^\/sales\/tickets/, { noun: 'Ticket', to: '/sales/tickets', namedFields: false }],
  [/^\/sales/, { noun: 'Contact', to: '/sales/contacts', namedFields: true }],
  [/^\/intake/, { noun: 'Intake', to: '/intake', namedFields: false }],
];

function searchScope(pathname: string): SearchScope {
  for (const [pattern, scope] of SCOPES) {
    if (pattern.test(pathname)) return scope;
  }
  return { noun: 'Candidate', to: '/recruit/candidates', namedFields: true };
}

export function ShellSidebar() {
  const recentListRef = useScrollShadow<HTMLDivElement>();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  );
  const [keywords, setKeywords] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const { items: recent, clear, limit, setLimit } = useRecentlyViewed();
  const [recentSettingsOpen, setRecentSettingsOpen] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [recentSettingsAt, setRecentSettingsAt] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const recentSettingsRef = useRef<HTMLDivElement>(null);
  const closeRecentSettings = useCallback(() => setRecentSettingsOpen(false), []);
  const recentSettings = useDismissable(
    recentSettingsOpen,
    closeRecentSettings,
    recentSettingsRef,
  );
  useOutsideClose(recentSettingsOpen, recentSettings.requestClose, recentSettingsRef);
  const advanced = useAdvancedSearch();
  const [grown, setGrown] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const scope = searchScope(pathname);

  useEffect(() => {
    if (!advanced.open || advanced.closing) {
      setGrown(false);
      return undefined;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [advanced.open, advanced.closing]);

  const quickSearchTerm = (keywords || [firstName, lastName].filter(Boolean).join(' ')).trim();

  const runQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearchTerm) return;
    navigate(`${scope.to}?search=${encodeURIComponent(quickSearchTerm)}`);
  };

  return (
    <aside
      className={collapsed ? 'fo-sidebar collapsed' : 'fo-sidebar'}
      data-named-fields={scope.namedFields ? 'true' : 'false'}
      aria-label="Quick search and recently viewed"
    >
      <div className="fo-sidebar-panel">
        <div className="fo-sidebar-panel-header">
          <span className="fo-sidebar-panel-title">Quick Search</span>
          <button
            type="button"
            className="fo-sidebar-panel-btn fo-sidebar-collapse-btn"
            data-collapsed={collapsed ? 'true' : 'false'}
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeftIcon size={20} className="fo-sidebar-collapse-chevron" />
          </button>
        </div>
        <div className="fo-sidebar-panel-collapse">
        <form className="fo-sidebar-panel-form" onSubmit={runQuickSearch}>
        <div className="fo-sidebar-panel-body">
          <div className="fo-qs-field">
            <span className="fo-qs-label">{scope.noun} Keywords</span>
            <div className="fo-qs-input-row">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                aria-label={`${scope.noun} keywords`}
              />
              <button
                type="submit"
                className="fo-icon-btn fo-qs-search-btn"
                aria-label="Search"
                disabled={quickSearchTerm.length === 0}
                title={
                  quickSearchTerm.length === 0
                    ? 'Type something to search for'
                    : `Search ${scope.noun.toLowerCase()}s for "${quickSearchTerm}"`
                }
              >
                <SearchIcon size={20} />
              </button>
            </div>
          </div>
          <div className="fo-qs-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                navigate(
                  quickSearchTerm ? `/search?q=${encodeURIComponent(quickSearchTerm)}` : '/search',
                )
              }
            >
              Search everything
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-expanded={advanced.node ? advanced.open && !advanced.closing : undefined}
              aria-controls={advanced.node ? 'list-filter-rail' : undefined}
              disabled={!advanced.node || advanced.narrow}
              title={
                advanced.node
                  ? undefined
                  : 'This page has no advanced search. Open a list such as Requisitions or Candidates.'
              }
              onClick={advanced.toggle}
            >
              Advanced Search
            </button>

          </div>
        </div>
          {advanced.node && advanced.open && !advanced.narrow && (
            <div className="fo-qs-advanced-grow" data-open={grown ? 'true' : 'false'}>
              <div className="fo-qs-advanced-clip">
                <div
                  className="fo-sidebar-panel-body fo-qs-advanced-section filter-rail"
                  id="list-filter-rail"
                  data-closing={advanced.closing ? 'true' : undefined}
                >
                  {advanced.node}
                </div>
              </div>
            </div>
          )}
          {scope.namedFields && (
            <div className="fo-sidebar-panel-body fo-qs-name-section">
            <div className="fo-qs-name-group">
              <div className="fo-qs-field fo-qs-name-field">
                <span className="fo-qs-label">{scope.noun} First Name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  aria-label={`${scope.noun} first name`}
                />
              </div>
              <div className="fo-qs-field fo-qs-name-field">
                <span className="fo-qs-label">{scope.noun} Last Name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-label={`${scope.noun} last name`}
                />
              </div>
              <button
                type="submit"
                className="fo-icon-btn fo-qs-search-btn fo-qs-name-search"
                aria-label="Search by name"
                disabled={quickSearchTerm.length === 0}
                title={
                  quickSearchTerm.length === 0
                    ? 'Type a first or last name to search for'
                    : `Search ${scope.noun.toLowerCase()}s for "${quickSearchTerm}"`
                }
              >
                <SearchIcon size={20} className="fo-qs-search-icon" />
              </button>
            </div>
            </div>
          )}
        </form>
        </div>
      </div>



      <div className="fo-sidebar-panel">
        <div className="fo-sidebar-panel-header">
          <span className="fo-sidebar-panel-title">Recently Viewed</span>
          <div className="fo-recent-settings-anchor" ref={recentSettingsRef}>
            <button
              type="button"
              className="fo-sidebar-panel-btn"
              aria-label="Configure Recently Viewed"
              aria-expanded={recentSettingsOpen}
              aria-controls="fo-recent-settings"
              title="Configure"
              onClick={(event) => {
                if (recentSettingsOpen) {
                  recentSettings.requestClose();
                  return;
                }
                setLimitDraft(String(limit));
                const box = event.currentTarget.getBoundingClientRect();
                setRecentSettingsAt({ top: box.bottom + 4, left: box.left });
                setRecentSettingsOpen(true);
              }}
            >
              <GearIcon size={20} />
            </button>
            {recentSettingsOpen && (
              <div
                className="fo-recent-settings"
                id="fo-recent-settings"
                style={{ top: recentSettingsAt.top, left: recentSettingsAt.left }}
                data-closing={recentSettings.closing ? 'true' : undefined}
              >
                <label className="fo-recent-settings-label" htmlFor="fo-recent-limit">
                  Records to keep
                </label>
                <div className="fo-recent-settings-row">
                  <input
                    id="fo-recent-limit"
                    className="input"
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    placeholder="10"
                    value={limitDraft}
                    onChange={(e) => setLimitDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const next = Number(limitDraft);
                      setLimit(Number.isFinite(next) && next > 0 ? Math.min(50, next) : 10);
                      recentSettings.requestClose();
                    }}
                  >
                    Save
                  </button>
                </div>
                <button
                  type="button"
                  className="fo-recent-settings-clear"
                  disabled={recent.length === 0}
                  onClick={() => {
                    clear();
                    recentSettings.requestClose();
                  }}
                >
                  Clear list
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="fo-sidebar-panel-collapse">
        <div className="fo-sidebar-panel-stack">
        <div className="fo-sidebar-panel-body">
          {recent.length === 0 ? (
            <EmptyState
              compact
              icon={<HistoryIcon size={32} />}
              title="Nothing viewed yet"
              hint="Records you open will appear here."
            />
          ) : (
            <div className="fo-recent-list fo-scroll-shade" ref={recentListRef}>
                {recent.map((item) => (
                  <button
                    key={`${item.type}:${item.id}`}
                    type="button"
                    className="fo-recent-item"
                    onClick={() => item.href && navigate(item.href)}
                    title={item.label}
                  >
                    {(() => {
                      const Icon = RECENT_ICONS[item.type] ?? RecordIcon;
                      return <Icon size={20} className="fo-recent-icon" />;
                    })()}
                    <span className="fo-recent-text">
                      <span className="fo-recent-name">{item.label}</span>
                      <span className="fo-recent-type">{sentenceCase(item.type)}</span>
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
        </div>
        </div>
      </div>
    </aside>
  );
}
