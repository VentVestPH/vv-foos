import './settings.css';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, LayoutGrid, Mail, Plug, Settings as GearIcon } from 'lucide-react';
import { RecordPage } from '../../components/ui/RecordPage';
import { usePlaceholder } from '../../shell/Placeholder';
import { Button } from '../../components/ui/Button';
import { EmailTemplatesCard } from './EmailTemplatesCard';
import { GoogleIntegrationCard } from './GoogleIntegrationCard';
import { DataExportCard } from './DataExportCard';

type SectionKey = 'integrations' | 'templates' | 'export' | 'other';

interface SettingsSection {
  key: SectionKey;
  label: string;
  description: string;
  icon: ReactNode;
}

const SECTIONS: SettingsSection[] = [
  { key: 'integrations', label: 'Integrations', description: 'Connect Gmail and Google Calendar to FOOS.', icon: <Plug size={20} aria-hidden="true" /> },
  { key: 'templates', label: 'Email templates', description: 'Reusable outreach messages with merge fields.', icon: <Mail size={20} aria-hidden="true" /> },
  { key: 'export', label: 'Data export', description: 'Download any module as a CSV file.', icon: <Download size={20} aria-hidden="true" /> },
  { key: 'other', label: 'Other areas', description: 'Administration areas that are not available yet.', icon: <LayoutGrid size={20} aria-hidden="true" /> },
];

const OTHER_AREAS = [
  { label: 'General Configuration', detail: 'Company-wide defaults such as time zone, currencies and numbering.' },
  { label: 'Career Section', detail: 'The public careers page: branding, published requisitions and the apply form.' },
  { label: 'User Accounts', detail: 'Single sign-on, password rules and account lifecycle.' },
];

export function SettingsPage() {
  const { show } = usePlaceholder();
  const [params, setParams] = useSearchParams();
  const sections = SECTIONS;
  const requested = params.get('section');
  const active = sections.find((section) => section.key === requested) ?? sections[0]!;

  const choose = (key: SectionKey) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('section', key);
      return next;
    }, { replace: true });
  };

  return (
    <RecordPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Settings' }]}
      title="Administration: Settings"
      icon={<GearIcon size={32} />}
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <div role="tablist" aria-orientation="vertical" aria-label="Settings sections">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                role="tab"
                id={`settings-tab-${section.key}`}
                aria-controls={`settings-panel-${section.key}`}
                aria-selected={section.key === active.key}
                tabIndex={section.key === active.key ? 0 : -1}
                className="settings-nav-item"
                onClick={() => choose(section.key)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                  event.preventDefault();
                  const index = sections.findIndex((item) => item.key === section.key);
                  const next = sections[(index + (event.key === 'ArrowDown' ? 1 : -1) + sections.length) % sections.length]!;
                  choose(next.key);
                  document.getElementById(`settings-tab-${next.key}`)?.focus();
                }}
              >
                <span className="settings-nav-icon">{section.icon}</span>
                <span className="settings-nav-text">
                  <span className="settings-nav-label">{section.label}</span>
                  <span className="settings-nav-description">{section.description}</span>
                </span>
              </button>
            ))}
          </div>
        </nav>

        <section
          className="settings-panel"
          role="tabpanel"
          id={`settings-panel-${active.key}`}
          aria-labelledby={`settings-tab-${active.key}`}
          key={active.key}
        >
          <header className="settings-panel-head">
            <span className="settings-panel-icon">{active.icon}</span>
            <div>
              <h2>{active.label}</h2>
              <p>{active.description}</p>
            </div>
          </header>
          {active.key === 'integrations' && <GoogleIntegrationCard />}
          {active.key === 'templates' && <EmailTemplatesCard />}
          {active.key === 'export' && <DataExportCard />}
          {active.key === 'other' && (
            <div className="settings-tiles">
              {OTHER_AREAS.map((area) => (
                <div className="settings-tile" key={area.label}>
                  <div>
                    <h3>{area.label}</h3>
                    <p>{area.detail}</p>
                  </div>
                  <Button size="sm" className="is-placeholder" onClick={() => show(area.label, `${area.label} is not available yet.`)}>
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </RecordPage>
  );
}
