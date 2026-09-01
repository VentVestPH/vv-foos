import { useState, type ReactNode } from 'react';

interface RecordPageProps {
  /** Human-facing code, e.g. REQ-0001. Optional (people have none). */
  code?: string;
  title: string;
  /** Large blue outline entity icon at left (Taleo page-header pattern). */
  icon?: ReactNode;
  /** Status chips and similar, rendered next to the title. */
  titleExtras?: ReactNode;
  /** Sticky single action bar — no duplicated toolbars (section 7). */
  actionBar?: ReactNode;
  children: ReactNode;
}

export function RecordPage({
  code,
  title,
  icon,
  titleExtras,
  actionBar,
  children,
}: RecordPageProps) {
  return (
    <div className="record-page">
      <div className="record-title-row">
        {icon && <span className="taleo-page-icon">{icon}</span>}
        {code && <span className="record-code">{code}</span>}
        <h1>{title}</h1>
        {titleExtras}
      </div>
      {actionBar && <div className="record-action-bar">{actionBar}</div>}
      {children}
    </div>
  );
}

interface RecordSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Collapsible titled section inside a RecordPage. */
export function RecordSection({
  title,
  defaultOpen = true,
  children,
}: RecordSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="record-section">
      <button
        type="button"
        className="record-section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="record-section-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {title}
      </button>
      {open && <div className="record-section-body">{children}</div>}
    </section>
  );
}
