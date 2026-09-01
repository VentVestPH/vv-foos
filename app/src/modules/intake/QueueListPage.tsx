import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ListPage } from '../../components/ui/ListPage';
import { Table, type TableColumn } from '../../components/ui/Table';
import { TaleoPager, usePagination } from '../../components/ui/TaleoPager';
import { TaleoPlaceholderAction, usePlaceholder } from '../../shell/TaleoPlaceholder';
import { GearIcon, InboxIcon } from '../../shell/icons';
import { useIntakeQueue } from './hooks';
import {
  CHANNEL_ICON,
  CHANNEL_LABEL,
  parsedOf,
  STATUS_LABEL,
  type IntakeItem,
} from './lib';
import { ItemDrawer } from './components/ItemDrawer';

export function QueueListPage() {
  const { show } = usePlaceholder();
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const columns: TableColumn<IntakeItem>[] = [
    {
      key: 'channel',
      header: '',
      width: '36px',
      render: (r) => {
        const Icon = CHANNEL_ICON[r.channel];
        return (
          <span title={CHANNEL_LABEL[r.channel]}>
            <Icon size={16} strokeWidth={1.6} aria-label={CHANNEL_LABEL[r.channel]} />
          </span>
        );
      },
    },
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

  const pager = usePagination(filtered);

  return (
    <ListPage
      title="Intake: Home"
      icon={<InboxIcon size={40} />}
      description="Intake is where new candidates and contacts arrive from LinkedIn, spreadsheets, email, and the careers page before they're merged or imported."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search name, company, title, batch…"
      actions={
        <>
          <Link to="/intake/linkedin">
            <Button size="sm">Paste LinkedIn URLs</Button>
          </Link>
          <Link to="/intake/sheet">
            <Button size="sm">Import a sheet</Button>
          </Link>
          {}
          <TaleoPlaceholderAction label="More" caret size="sm" />
          <button
            type="button"
            className="taleo-gear-btn"
            aria-label="Configure columns"
            onClick={() =>
              show(
                'Configure columns',
                'Channel/Target/Status filters are already available in the Advanced Search panel on this page.',
              )
            }
          >
            <GearIcon size={16} />
          </button>
        </>
      }
      filterRail={
        <details className="taleo-advanced-search" open>
          <summary>Advanced Search</summary>
          <div className="taleo-advanced-search-body">
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
            <label className="intake-showall-toggle">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              Show imported &amp; rejected
            </label>
          </div>
        </details>
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
      <TaleoPager
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
        emptyText={loading ? 'Loading…' : 'Nothing in the queue.'}
      />

      <TaleoPager
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
