import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { CollapseAllButton, useSectionCollapse } from './SectionCollapse';

interface RecordPageProps {
  code?: string;
  title: string;

  icon?: ReactNode;

  titleExtras?: ReactNode;

  headerMeta?: ReactNode;

  backTo?: ReactNode;

  breadcrumbs?: BreadcrumbItem[];

  headerActions?: ReactNode;

  actionBar?: ReactNode;
  children: ReactNode;
}

export function RecordPage({
  code,
  title,
  icon,
  titleExtras,
  headerMeta,
  backTo,
  breadcrumbs,
  headerActions,
  actionBar,
  children,
}: RecordPageProps) {
  useDocumentTitle(code ? `${code} ${title}` : title);

  return (
    <div className="record-page">
      <div className="fo-page-head">
        {(backTo || code || breadcrumbs) && (
          <div className="record-breadcrumb">
            {backTo}
            {breadcrumbs ? (
              <Breadcrumbs items={breadcrumbs} />
            ) : (
              code && <span className="record-code">{code}</span>
            )}
          </div>
        )}
        <div className="fo-page-header">
          {icon && <span className="fo-page-icon">{icon}</span>}
          <div className="fo-page-header-text">
            <div className="fo-page-header-title-row">
              <h1>{title}</h1>
              {titleExtras}
              <div className="fo-page-header-actions">
                <CollapseAllButton />
                {headerActions}
              </div>
            </div>
            {headerMeta}
          </div>
        </div>
      </div>
      {actionBar && (
        <div className="fo-page-toolbar">
          <div className="record-action-bar">{actionBar}</div>
        </div>
      )}
      {children}
    </div>
  );
}

interface RecordSectionProps {
  title: string;
  defaultOpen?: boolean;
  id?: string;
  count?: number;
  empty?: boolean;
  hidden?: boolean;
  children: ReactNode;
}

export function RecordSection({
  title,
  defaultOpen = true,
  id,
  count,
  empty = false,
  hidden = false,
  children,
}: RecordSectionProps) {
  const startOpen = empty ? false : defaultOpen;
  const [open, setOpen] = useState(startOpen);
  const [everOpened, setEverOpened] = useState(startOpen);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const userToggled = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const key = useId();
  const bus = useSectionCollapse();

  useEffect(() => {
    if (userToggled.current) return;
    setOpen(startOpen);
    if (startOpen) setEverOpened(true);
  }, [startOpen]);

  const openState = useRef(open);
  openState.current = open;

  useEffect(() => {
    if (!bus) return undefined;
    return bus.register(
      key,
      (next) => {
        userToggled.current = true;
        setOpen(next);
        if (next) setEverOpened(true);
      },
      () => openState.current,
    );
  }, [bus, key, startOpen]);

  useEffect(() => {
    bus?.report(key, open);
  }, [bus, key, open]);

  useEffect(() => {
    if (userToggled.current) return;
    setOpen(startOpen);
    if (startOpen) setEverOpened(true);
  }, [startOpen]);

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

  if (hidden) return null;

  return (
    <section className="record-section" data-open={open ? 'true' : 'false'} id={id}>
      <button type="button" className="record-section-header" onClick={toggle} aria-expanded={open}>
        <span className="record-section-chevron" aria-hidden="true">
          <ChevronDown size={20} />
        </span>
        {count === undefined ? title : `${title} (${count})`}
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
