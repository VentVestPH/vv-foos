import { useState, type ReactNode } from 'react';

export interface SidePanelTab {
  key: string;
  label: string;
  /** Count shown next to the label; omit to hide. */
  count?: number;
  content: ReactNode;
}

interface SidePanelTabsProps {
  tabs: SidePanelTab[];
  defaultTab?: string;
}

/**
 * Tabbed side panels for the person-record toolkit — the Gate 1 nine:
 * Notes, Calls, Meetings, Events, Emails, Tasks, Reminders, Files, Resumes.
 * Each panel maps to an existing table (activities/tasks/reminders/attachments);
 * modules supply the content, this component only renders the frame.
 */
export function SidePanelTabs({ tabs, defaultTab }: SidePanelTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="side-tabs">
      <div className="side-tabs-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === current?.key}
            className={tab.key === current?.key ? 'side-tab active' : 'side-tab'}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="side-tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className="side-tabs-panel" role="tabpanel">
        {current?.content}
      </div>
    </div>
  );
}

/** The nine person-record panel keys, in Gate 1 order. */
export const PERSON_TOOLKIT_TABS = [
  'notes',
  'calls',
  'meetings',
  'events',
  'emails',
  'tasks',
  'reminders',
  'files',
  'resumes',
] as const;

export type PersonToolkitTab = (typeof PERSON_TOOLKIT_TABS)[number];
