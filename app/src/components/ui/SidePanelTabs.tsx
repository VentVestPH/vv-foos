import { useState, type ReactNode } from 'react';

interface SidePanelTab {
  key: string;
  label: string;

  count?: number;
  content: ReactNode;
}

interface SidePanelTabsProps {
  tabs: SidePanelTab[];
  defaultTab?: string;
}

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
