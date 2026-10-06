import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSubmittedSearch } from '../../lib/quickSearch';
import { useSession } from '../../auth/SessionProvider';
import { intakeSearchHints } from '../../lib/searchHints';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ListPage } from '../../components/ui/ListPage';
import { BulkBar } from '../../components/ui/BulkBar';
import { Table, type TableColumn } from '../../components/ui/Table';
import { Pager, usePagination } from '../../components/ui/Pager';
import { SettingsButton } from '../../components/ui/SettingsButton';
import { ColumnSettingsDialog } from '../../components/ui/ColumnSettingsDialog';
import {
  SavedViewsControl,
  useSavedViews,
  type ViewState,
} from '../../components/ui/SavedViews';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMinimumVisible } from '../../hooks/useMinimumVisible';
import {
  Inbox as InboxIcon,
  Link2 as LinkIcon,
  RefreshCw as RefreshIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { useIntakeQueue } from './hooks';
import {
  CHANNEL_ICON,
  CHANNEL_LABEL,
  parsedOf,
  STATUS_LABEL,
  TARGET_LABEL,
  type IntakeItem,
} from './lib';
import { ItemDrawer } from './components/ItemDrawer';
import { IntakeDeleteDialog } from './components/IntakeDeleteDialog';

const QUEUE_COLUMN_DEFS = [
  { key: 'full_name', header: 'Name' },
  { key: 'headline', header: 'Headline / role' },
  { key: 'target_type', header: 'Target' },
  { key: 'batch_label', header: 'Batch' },
  { key: 'status', header: 'Status' },
  { key: 'created_at', header: 'Received' },
];

const QUEUE_ALL_COLUMN_KEYS = QUEUE_COLUMN_DEFS.map((c) => c.key);

const QUEUE_EMPTY_FILTERS = { channel: '', targetType: '', status: '', showAll: '' };

export function QueueListPage() {
  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();
  const [params] = useSearchParams();
  const { staff } = useSession();
  const savedViews = useSavedViews('intake');
  const [channel, setChannel] = useState(() => params.get('channel') ?? '');
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('item'));
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(QUEUE_ALL_COLUMN_KEYS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<IntakeItem[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const columns = useMemo<TableColumn<IntakeItem>[]>(() => {
  const channelColumn: TableColumn<IntakeItem> = {
      key: 'channel',
      header: '',
      width: '36px',
      sortValue: (r) => CHANNEL_LABEL[r.channel],
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
    { key: 'full_name', header: 'Name' },
    {
      key: 'headline',
      header: 'Headline / role',
      capped: true,
      sortValue: (r) => {
        const p = parsedOf(r);
        return [p.headline, p.company, p.title].filter(Boolean).join(' · ').toLowerCase();
      },
      render: (r) => {
        const p = parsedOf(r);
        return [p.headline, p.company, p.title].filter(Boolean).join(' · ');
      },
    },
    {
      key: 'target_type',
      header: 'Target',
      render: (r) => TARGET_LABEL[r.target_type],
    },
    { key: 'batch_label', header: 'Batch' },
    {
      key: 'status',
      header: 'Status',
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
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  const byKey = new Map(optionalColumns.map((c) => [c.key, c]));
  return [
    channelColumn,
    ...columnOrder.flatMap((key) => {
      const col = byKey.get(key);
      return col && !hiddenCols.includes(key) ? [col] : [];
    }),
  ];
  }, [columnOrder, hiddenCols]);

  const visibleCols = useMemo(
    () => columnOrder.filter((key) => !hiddenCols.includes(key)),
    [columnOrder, hiddenCols],
  );

  const currentState = useCallback(
    (): ViewState => ({
      filters: {
        channel,
        targetType,
        status,
        showAll: showAll ? 'true' : '',
      },
      columns: visibleCols,
      sort,
    }),
    [channel, targetType, status, showAll, visibleCols, sort],
  );

  const applyView = useCallback((state: ViewState) => {
    const next = { ...QUEUE_EMPTY_FILTERS, ...state.filters };
    setChannel(next.channel);
    setTargetType(next.targetType);
    setStatus(next.status);
    setShowAll(next.showAll === 'true');
    if (state.columns.length > 0) {
      const saved = state.columns.filter((k) => QUEUE_ALL_COLUMN_KEYS.includes(k));
      setColumnOrder([...saved, ...QUEUE_ALL_COLUMN_KEYS.filter((k) => !saved.includes(k))]);
      setHiddenCols(QUEUE_ALL_COLUMN_KEYS.filter((k) => !saved.includes(k)));
    }
    setSort(state.sort);
  }, []);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const value = (row: IntakeItem): string =>
      String(
        (col.sortValue
          ? col.sortValue(row)
          : (row as unknown as Record<string, unknown>)[col.key]) ?? '',
      );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => value(a).localeCompare(value(b)) * dir);
  }, [filtered, columns, sort]);

  const changeSelection = useCallback((next: Set<string>) => {
    setNotice(null);
    setSelected(next);
  }, []);

  const selectedItems = items.filter((i) => selected.has(i.id));

  const showSkeleton = useMinimumVisible(loading);

  const pager = usePagination(sorted);

  return (
    <ListPage
      flush
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Intake' }]}
      title="Intake"
      icon={<InboxIcon size={32} />}
      description="Intake is where new candidates and contacts arrive from LinkedIn, spreadsheets, email, and the careers page before they're merged or imported."
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchPlaceholder="Search name, company, title, batch…"
      searchHints={intakeSearchHints}
      savedViewsSlot={
        <SavedViewsControl
          views={savedViews.views}
          currentState={currentState}
          onApply={applyView}
          onSave={savedViews.save}
          onDelete={savedViews.remove}
          ownStaffId={staff?.id}
        />
      }
      actions={
        <>
          <RefreshButton onClick={reload} />
          <Link to="/intake/linkedin">
            <Button size="sm" variant="primary">
              <LinkIcon size={20} aria-hidden="true" />
              Paste URLs
            </Button>
          </Link>
          <Link to="/intake/sheet">
            <Button size="sm">
              <Upload size={20} aria-hidden="true" />
              Import
            </Button>
          </Link>
          <IntakeGearButton onOpen={() => setSettingsOpen(true)} />
        </>
      }
      bulkBarOpen={selected.size > 0}
      bulkBar={
        <BulkBar count={selected.size}>
          <Button
            variant="danger"
            disabled={selectedItems.length === 0}
            title={selectedItems.length === 0 ? 'Tick an item to delete it.' : undefined}
            onClick={() => setDeleting(selectedItems)}
          >
            <Trash2 size={20} aria-hidden="true" />
            Delete
          </Button>
        </BulkBar>
      }
      toolbarActions={
        <label className="intake-showall-toggle">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Show imported / rejected
        </label>
      }
      filterRail={
          <div className="fo-advanced-search-body intake-advanced-search">
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
          </div>
      }
      exportRows={sorted}
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
      {savedViews.error && (
        <p className="form-error" role="alert">
          {savedViews.error}
        </p>
      )}
      {notice && (
        <p className="text-secondary fo-bulk-notice" role="status">
          {notice}
        </p>
      )}
      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      {showSkeleton ? (
        <div className="fo-skeleton-card">
          <Skeleton rows={8} label="Loading the intake queue" />
        </div>
      ) : (
      <Table
        columns={columns}
        rows={pager.pageRows}
        rowKey={(r) => r.id}
        sortKey={sort?.key ?? null}
        sortDir={sort?.dir ?? 'asc'}
        onSortChange={(key, dir) => setSort({ key, dir })}
        selectable
        selected={selected}
        onSelectionChange={changeSelection}
        onRowClick={(r) => setSelectedId(r.id)}
        emptyText="Nothing in the queue."
      />
      )}

      {settingsOpen && (
        <ColumnSettingsDialog
          title="Column settings"
          hint="Drag a column to change where it sits, or untick it to hide it. Save a view to keep this arrangement."
          columns={QUEUE_COLUMN_DEFS}
          order={columnOrder}
          hidden={hiddenCols}
          onOrderChange={setColumnOrder}
          onToggle={(key) =>
            setHiddenCols(
              hiddenCols.includes(key)
                ? hiddenCols.filter((k) => k !== key)
                : [...hiddenCols, key],
            )
          }
          onReset={() => {
            setColumnOrder(QUEUE_ALL_COLUMN_KEYS);
            setHiddenCols([]);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      {deleting && (
        <IntakeDeleteDialog
          items={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(deleted, refused) => {
            setDeleting(null);
            setSelected(new Set());
            setNotice(
              refused === 0
                ? `${deleted} ${deleted === 1 ? 'item' : 'items'} deleted.`
                : `${deleted} of ${deleted + refused} deleted. ${refused} left in place, because your role cannot remove them.`,
            );
            reload();
          }}
        />
      )}
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

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="fo-gear-btn"
      aria-label="Refresh the queue"
      title="Refresh the queue"
      onClick={onClick}
    >
      <RefreshIcon size={20} aria-hidden="true" />
    </button>
  );
}

function IntakeGearButton({ onOpen }: { onOpen: () => void }) {
  return (
    <SettingsButton
      label="Column settings"
      title="Choose the column order and which columns show"
      onClick={onOpen}
    />
  );
}
