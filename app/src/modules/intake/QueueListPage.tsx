import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ListPage, useListPageFilters } from '../../components/ui/ListPage';
import { Table, type TableColumn } from '../../components/ui/Table';
import { Pager, usePagination } from '../../components/ui/Pager';
import { PlaceholderAction } from '../../shell/Placeholder';
import { Inbox as InboxIcon, Settings as GearIcon } from 'lucide-react';
import { useIntakeQueue } from './hooks';
import {
  CHANNEL_ICON,
  CHANNEL_LABEL,
  parsedOf,
  STATUS_LABEL,
  type IntakeItem,
} from './lib';
import { ItemDrawer } from './components/ItemDrawer';

const QUEUE_COLUMN_DEFS = [
  { key: 'full_name', header: 'Name' },
  { key: 'headline', header: 'Headline / role' },
  { key: 'target_type', header: 'Target' },
  { key: 'batch_label', header: 'Batch' },
  { key: 'status', header: 'Status' },
  { key: 'created_at', header: 'Received' },
];

const QUEUE_ALL_COLUMN_KEYS = QUEUE_COLUMN_DEFS.map((c) => c.key);

export function QueueListPage() {
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const [channel, setChannel] = useState(() => params.get('channel') ?? '');
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(QUEUE_ALL_COLUMN_KEYS);

  const { items, loading, reload } = useIntakeQueue({
    channel: channel || undefined,
    targetType: targetType || undefined,
    status: status || undefined,
    showAll,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const p = parsedOf(i);
      return (
        (i.full_name ?? '').toLowerCase().includes(q) ||
        (p.company ?? '').toLowerCase().includes(q) ||
        (p.title ?? '').toLowerCase().includes(q) ||
        (i.batch_label ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const channelColumn: TableColumn<IntakeItem> = {
      key: 'channel',
      header: '',
      width: '36px',
      render: (r) => {
        const Icon = CHANNEL_ICON[r.channel];
        return (
          <span title={CHANNEL_LABEL[r.channel]}>
            <Icon size={20} aria-label={CHANNEL_LABEL[r.channel]} />
          </span>
        );
      },
  };

  const optionalColumns: TableColumn<IntakeItem>[] = [
    { key: 'full_name', header: 'Name', sortable: true },
    {
      key: 'headline',
      header: 'Headline / role',
      capped: true,
      render: (r) => {
        const p = parsedOf(r);
        return [p.headline, p.company, p.title].filter(Boolean).join(' · ');
      },
    },
    { key: 'target_type', header: 'Target', sortable: true },
    { key: 'batch_label', header: 'Batch' },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) => (
        <span className={r.duplicate_of ? 'badge-tone badge-dup' : 'badge-tone'}>
          {STATUS_LABEL[r.status]}
          {r.duplicate_of ? ' · dup' : ''}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Received',
      sortable: true,
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  const columns: TableColumn<IntakeItem>[] = [
    channelColumn,
    ...optionalColumns.filter((c) => visibleCols.includes(c.key)),
  ];

  const pager = usePagination(filtered);

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Intake' }]}
      title="Intake"
      icon={<InboxIcon size={32} />}
      description="Intake is where new candidates and contacts arrive from LinkedIn, spreadsheets, email, and the careers page before they're merged or imported."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search name, company, title, batch…"
      actions={
        <>
          <Link to="/intake/linkedin">
            <Button size="sm" variant="primary">
              Paste LinkedIn URLs
            </Button>
          </Link>
          <Link to="/intake/sheet">
            <Button size="sm">Import a sheet</Button>
          </Link>
          <PlaceholderAction label="More" caret size="sm" />
          <IntakeGearButton />
        </>
      }
      filterRail={
          <div className="fo-advanced-search-body">
            <Select
              label="Channel"
              placeholder="All channels"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={[
                { value: 'linkedin_url', label: 'LinkedIn' },
                { value: 'email', label: 'Email' },
                { value: 'sheet_import', label: 'Sheet import' },
                { value: 'careers_form', label: 'Careers page' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
            <Select
              label="Target"
              placeholder="Candidate + contact"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              options={[
                { value: 'candidate', label: 'Candidate' },
                { value: 'contact', label: 'Contact' },
              ]}
            />
            <Select
              label="Status"
              placeholder="Pending + parsed (default)"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'parsed', label: 'Parsed' },
                { value: 'graded', label: 'Graded' },
                { value: 'imported', label: 'Imported' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
            <div className="field">
              <span className="field-label">Columns</span>
              <div className="checkbox-list">
                {QUEUE_COLUMN_DEFS.map((c) => (
                  <label key={c.key} className="checkline">
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(c.key)}
                      onChange={(e) =>
                        setVisibleCols(
                          e.target.checked
                            ? [...visibleCols, c.key]
                            : visibleCols.filter((k) => k !== c.key),
                        )
                      }
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            </div>
            <label className="intake-showall-toggle">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              Show imported &amp; rejected
            </label>
          </div>
      }
      exportRows={filtered}
      exportColumns={[
        { key: 'full_name', header: 'Name' },
        { key: 'channel', header: 'Channel' },
        { key: 'target_type', header: 'Target' },
        { key: 'status', header: 'Status' },
        { key: 'batch_label', header: 'Batch' },
        { key: 'created_at', header: 'Received' },
      ]}
      exportFilename="intake-queue.csv"
    >
      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      <Table
        busy={loading}
        columns={columns}
        rows={pager.pageRows}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
        emptyText="Nothing in the queue."
      />

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      {selectedId &&
        (() => {
          const selected = items.find((i) => i.id === selectedId);
          if (!selected) return null;
          return (
            <ItemDrawer
              item={selected}
              onClose={() => setSelectedId(null)}
              onSaved={reload}
              onDone={() => {
                reload();
                setSelectedId(null);
              }}
            />
          );
        })()}
    </ListPage>
  );
}

function IntakeGearButton() {
  const { openFilters } = useListPageFilters();
  return (
    <button
      type="button"
      className="fo-gear-btn"
      aria-label="Configure columns"
      onClick={() => openFilters({ focusColumns: true })}
    >
      <GearIcon size={20} />
    </button>
  );
}
