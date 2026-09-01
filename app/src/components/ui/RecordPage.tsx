import { useState, type ReactNode } from 'react';

interface RecordPageProps {
  code?: string;
  title: string;

  icon?: ReactNode;

  titleExtras?: ReactNode;

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
