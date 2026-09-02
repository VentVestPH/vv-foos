import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

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
        {icon && <span className="fo-page-icon">{icon}</span>}
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
  const [everOpened, setEverOpened] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const userToggled = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userToggled.current) return;
    setOpen(defaultOpen);
    if (defaultOpen) setEverOpened(true);
  }, [defaultOpen]);

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node || !everOpened) return;
    const measure = () => setContentHeight(node.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [everOpened]);

  const toggle = () => {
    userToggled.current = true;
    setOpen((v) => {
      if (!v) setEverOpened(true);
      return !v;
    });
  };

  const rows = !open ? '0px' : contentHeight === null ? 'auto' : `${contentHeight}px`;

  return (
    <section className="record-section" data-open={open ? 'true' : 'false'}>
      <button type="button" className="record-section-header" onClick={toggle} aria-expanded={open}>
        <span className="record-section-chevron" aria-hidden="true">
          <ChevronDown size={14} />
        </span>
        {title}
      </button>
      <div
        className="record-section-collapse"
        style={{ gridTemplateRows: rows }}
        aria-hidden={open ? undefined : true}
        {...(open ? {} : { inert: '' })}
      >
        <div className="record-section-clip">
          <div className="record-section-body" ref={bodyRef}>
            {everOpened ? children : null}
          </div>
        </div>
      </div>
    </section>
  );
}
