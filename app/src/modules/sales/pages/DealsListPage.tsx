import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { DEAL_STAGES, type Database, type DealStage } from '../../../lib/database.types';
import { useSession } from '../../../auth/SessionProvider';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { BulkBar } from '../../../components/ui/BulkBar';
import { ColumnSettingsDialog } from '../../../components/ui/ColumnSettingsDialog';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { SavedViewsControl, useSavedViews, type ViewState } from '../../../components/ui/SavedViews';
import { useListLink } from '../../../lib/listReturn';
import { useSubmittedSearch } from '../../../lib/quickSearch';
import { dealSearchHints } from '../../../lib/searchHints';
import { KanbanBoard } from '../../../components/ui/KanbanBoard';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { useViewPref } from '../../../hooks/useViewPref';
import { KanbanSkeleton } from '../../../components/ui/KanbanSkeleton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { LostReasonDialog } from '../components/LostReasonDialog';
import { DealDeleteDialog, type DealDeleteTarget } from '../components/DealDeleteDialog';
import {
  Briefcase as BriefcaseIcon,
  Columns3 as KanbanIcon,
  Plus,
  Table2 as TableIcon,
  Trash2,
} from 'lucide-react';
import { useCanEditCrm, useCompanyOptions, useStaffList } from '../hooks';
import { fmtDate, fmtMoney, stageLabel } from '../lib';
import { EMPTY_CELL } from '../../../lib/format';

const DEAL_PAGE_SIZE = 20;
const KANBAN_CARDS_PER_STAGE = 25;
const DEAL_EXPORT_PAGE_SIZE = 1000;
const DEAL_EXPORT_ROW_CAP = 10000;

const DEAL_VIEW_COLUMNS =
  'id, display_code, name, stage, company_id, company_name, primary_contact_id, owner_id, owner_name, value, currency, probability, expected_close, lost_reason, is_test, created_at, updated_at';

const DEAL_SORT_COLUMNS: Record<string, string> = {
  display_code: 'display_code',
  name: 'name',
  company: 'company_name',
  stage: 'stage',
  value: 'value',
  probability: 'probability',
  expected_close: 'expected_close',
  owner: 'owner_name',
  updated_at: 'updated_at',
};

const COLUMN_DEFS: { key: string; header: string }[] = [
  { key: 'display_code', header: 'Code' },
  { key: 'name', header: 'Deal' },
  { key: 'company', header: 'Company' },
  { key: 'stage', header: 'Stage' },
  { key: 'value', header: 'Value' },
  { key: 'probability', header: 'Prob.' },
  { key: 'expected_close', header: 'Expected close' },
  { key: 'owner', header: 'Owner' },
  { key: 'updated_at', header: 'Last Updated' },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

const COLUMN_HEADER: Record<string, string> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, c.header]),
);

const STAGE_DEFS = DEAL_STAGES.map((s) => ({ key: s, header: stageLabel(s) }));
const ALL_STAGE_KEYS: string[] = [...DEAL_STAGES];

type DealListRow = Omit<Database['public']['Views']['deal_list']['Row'], 'search_text'>;

function dealLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function dealBaseQuery() {
  return supabase.from('deal_list').select(DEAL_VIEW_COLUMNS, { count: 'exact' });
}

type DealQuery = ReturnType<typeof dealBaseQuery>;

type ViewMode = 'kanban' | 'table';

const DEAL_VIEWS = ['kanban', 'table'] as const;

export function DealsListPage() {
  const navigate = useNavigate();
  const openRecord = useListLink();
  const canEdit = useCanEditCrm();
  const mobile = useIsMobile();
  const canBulk = canEdit && !mobile;
  const { staff } = useSession();
  const { staffName, staffOptions } = useStaffList();
  const { companyName } = useCompanyOptions();
  const savedViews = useSavedViews('deal');
  const [params] = useSearchParams();

  const [deals, setDeals] = useState<DealListRow[]>([]);
  const [board, setBoard] = useState<Map<string, { cards: DealListRow[]; total: number }>>(
    new Map(),
  );
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const { view, setView } = useViewPref<ViewMode>('foos.deals.view', DEAL_VIEWS, 'kanban');
  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();
  const [stageFilter, setStageFilter] = useState(() => params.get('stage') ?? '');
  const [ownerFilter, setOwnerFilter] = useState(() => params.get('owner_id') ?? '');
  const [companyFilter] = useState(() => params.get('company_id') ?? '');
  const [pendingLost, setPendingLost] = useState<DealListRow | null>(null);
  const [wonNotice, setWonNotice] = useState<string | null>(null);
  const [wonClosing, setWonClosing] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<DealDeleteTarget[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMN_KEYS);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [stageOrder, setStageOrder] = useState<string[]>(ALL_STAGE_KEYS);
  const [hiddenStages, setHiddenStages] = useState<string[]>([]);

  const visibleCols = useMemo(
    () => columnOrder.filter((key) => !hiddenCols.includes(key)),
    [columnOrder, hiddenCols],
  );
  const visibleStages = useMemo(
    () => stageOrder.filter((key) => !hiddenStages.includes(key)),
    [stageOrder, hiddenStages],
  ) as DealStage[];

  const applyDealFilters = useCallback(
    (q: DealQuery): DealQuery => {
      let out = q;
      if (stageFilter) out = out.eq('stage', stageFilter as DealStage);
      if (ownerFilter) out = out.eq('owner_id', ownerFilter);
      if (companyFilter) out = out.eq('company_id', companyFilter);
      const term = search.trim().toLowerCase();
      if (term) out = out.ilike('search_text', `%${dealLikeLiteral(term)}%`);
      return out;
    },
    [stageFilter, ownerFilter, companyFilter, search],
  );

  const beginLoad = useLatestOnly();

  const load = useCallback(async (silent = false) => {
    const isCurrent = beginLoad();
    if (!silent) setLoading(true);
    try {
      if (view === 'kanban') {
        const columns = await Promise.all(
          visibleStages.map(async (stage) => {
            if (stageFilter && stage !== stageFilter) {
              return [stage, { cards: [] as DealListRow[], total: 0 }] as const;
            }
            const { data, count, error } = await applyDealFilters(dealBaseQuery())
              .eq('stage', stage)
              .order('updated_at', { ascending: false })
              .order('id', { ascending: true })
              .range(0, KANBAN_CARDS_PER_STAGE - 1);
            if (error) throw new Error(error.message);
            return [stage, { cards: data ?? [], total: count ?? 0 }] as const;
          }),
        );
        const next = new Map<string, { cards: DealListRow[]; total: number }>(columns);
        if (!isCurrent()) return;
        setBoard(next);
        setTotal([...next.values()].reduce((n, c) => n + c.total, 0));
      } else {
        const sortColumn = sort ? DEAL_SORT_COLUMNS[sort.key] : undefined;
        let q = applyDealFilters(dealBaseQuery());
        q = sortColumn
          ? q.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false })
          : q.order('updated_at', { ascending: false });
        const start = page * DEAL_PAGE_SIZE;
        const { data, count, error } = await q
          .order('id', { ascending: true })
          .range(start, start + DEAL_PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        if (!isCurrent()) return;
        setDeals(data ?? []);
        setTotal(count ?? 0);
      }
      setMoveError(null);
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [view, applyDealFilters, stageFilter, visibleStages, sort, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [stageFilter, ownerFilter, companyFilter, search, sort, view]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!wonNotice) return;
    setWonClosing(false);
    const fade = setTimeout(() => setWonClosing(true), 3860);
    const t = setTimeout(() => setWonNotice(null), 4000);
    return () => {
      clearTimeout(fade);
      clearTimeout(t);
    };
  }, [wonNotice]);

  const writeStage = async (deal: DealListRow, toStage: DealStage, lostReason?: string) => {
    setMoveError(null);
    const patch =
      toStage === 'lost'
        ? { stage: toStage, lost_reason: lostReason ?? null }
        : { stage: toStage, lost_reason: null };
    const { error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', deal.id);
    if (error) {
      setMoveError(`Could not move ${deal.display_code}: ${error.message}`);
      await load(true);
      return;
    }
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, ...patch } : d)));
    setBoard((prev) => {
      const next = new Map(prev);
      const from = next.get(deal.stage);
      if (from) {
        next.set(deal.stage, {
          cards: from.cards.filter((c) => c.id !== deal.id),
          total: Math.max(0, from.total - 1),
        });
      }
      const to = next.get(toStage);
      if (to) {
        const moved = { ...deal, ...patch } as DealListRow;
        next.set(toStage, {
          cards: [moved, ...to.cards].slice(0, KANBAN_CARDS_PER_STAGE),
          total: to.total + 1,
        });
      }
      return next;
    });
    if (toStage === 'won') {
      setWonNotice(`${deal.display_code} · ${deal.name} — won.`);
    }
  };

  const onMove = (dealId: string, toStage: string) => {
    if (!canEdit) return;
    const onBoard = [...board.values()].flatMap((c) => c.cards);
    const deal = deals.find((d) => d.id === dealId) ?? onBoard.find((d) => d.id === dealId);
    if (!deal || deal.stage === toStage) return;
    if (toStage === 'lost') {
      setPendingLost(deal);
      return;
    }
    void writeStage(deal, toStage as DealStage);
  };

  const kanbanCards = [...board.values()]
    .flatMap((c) => c.cards)
    .map((d) => ({
      id: d.id,
      stage: d.stage,
      content: (
        <div className="sales-kanban-card">
          <span className="sales-kanban-card-code">
            <button
              type="button"
              className="sales-kanban-card-open"
              onClick={() => openRecord(`/sales/deals/${d.id}`)}
            >
              {d.display_code}
            </button>
            {d.is_test && (
              <>
                {' '}
                <Badge tone="warning">TEST</Badge>
              </>
            )}
          </span>
          <span className="sales-kanban-card-name">{d.name}</span>
          <span>{d.company_name ?? ''}</span>
          <span className="sales-kanban-card-value">
            {fmtMoney(d.value, d.currency)}
            {d.probability !== null && ` · ${d.probability}%`}
          </span>
          <span>
            {`${fmtDate(d.expected_close)} · ${d.owner_name ?? ''}`}
          </span>
        </div>
      ),
    }));

  const columnExtras = useCallback(
    (stageKey: string) => {
      const col = board.get(stageKey);
      if (!col || col.total <= col.cards.length) return null;
      return (
        <span className="text-secondary sales-kanban-more">
          {`showing ${col.cards.length} of ${col.total.toLocaleString()}`}
        </span>
      );
    },
    [board],
  );

  const changeSelection = useCallback((next: Set<string>) => {
    setNotice(null);
    setSelected(next);
  }, []);

  const columns = useMemo<TableColumn<DealListRow>[]>(() => {
    const defs: Record<string, TableColumn<DealListRow>> = {
      display_code: { key: 'display_code', header: 'Code' },
      name: {
        key: 'name',
        header: 'Deal',
        render: (d) => (
          <span className="sales-badges">
            <button
              type="button"
              className="link-btn"
              onClick={(e) => {
                e.stopPropagation();
                openRecord(`/sales/deals/${d.id}`);
              }}
            >
              {d.name}
            </button>
            {d.is_test && <Badge tone="warning">TEST</Badge>}
          </span>
        ),
      },
      company: {
        key: 'company',
        header: 'Company',
        sortValue: (d) => companyName(d.company_id),
        render: (d) => companyName(d.company_id),
      },
      stage: {
        key: 'stage',
        header: 'Stage',
        sortValue: (d) => DEAL_STAGES.indexOf(d.stage),
        render: (d) => <StatusBadge status={d.stage} />,
      },
      value: {
        key: 'value',
        header: 'Value',
        sortValue: (d) => d.value ?? 0,
        render: (d) => fmtMoney(d.value, d.currency),
      },
      probability: {
        key: 'probability',
        header: 'Prob.',
        render: (d) => (d.probability === null ? EMPTY_CELL : `${d.probability}%`),
      },
      expected_close: {
        key: 'expected_close',
        header: 'Expected close',
        sortValue: (d) => d.expected_close ?? '',
        render: (d) => fmtDate(d.expected_close),
      },
      owner: {
        key: 'owner',
        header: 'Owner',
        sortValue: (d) => staffName(d.owner_id),
        render: (d) => staffName(d.owner_id),
      },
      updated_at: {
        key: 'updated_at',
        header: 'Last Updated',
        render: (d) => fmtDate(d.updated_at),
      },
    };
    return visibleCols.flatMap((key) => {
      const col = defs[key];
      return col ? [col] : [];
    });
  }, [visibleCols, openRecord, companyName, staffName]);

  const exportDealRows = useCallback(async () => {
    if (total > DEAL_EXPORT_ROW_CAP) {
      setMoveError(
        `That filter matches ${total.toLocaleString()} deals, more than the ${DEAL_EXPORT_ROW_CAP.toLocaleString()} an in-browser export can build. Narrow the filter and try again.`,
      );
      return [];
    }
    const collected: DealListRow[] = [];
    for (let start = 0; start < DEAL_EXPORT_ROW_CAP; start += DEAL_EXPORT_PAGE_SIZE) {
      const { data, error } = await applyDealFilters(dealBaseQuery())
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })
        .range(start, start + DEAL_EXPORT_PAGE_SIZE - 1);
      if (error) {
        setMoveError(error.message);
        return [];
      }
      const batch = data ?? [];
      collected.push(...batch);
      if (batch.length < DEAL_EXPORT_PAGE_SIZE) break;
    }
    setMoveError(null);
    return collected
      .filter((d) => !d.is_test)
      .map((d) => ({
        display_code: d.display_code,
        name: d.name,
        company: d.company_name ?? '',
        stage: stageLabel(d.stage),
        value: d.value,
        probability: d.probability,
        expected_close: d.expected_close,
        owner: d.owner_name ?? '',
        updated_at: d.updated_at,
      }));
  }, [applyDealFilters, total]);

  const currentState = useCallback(
    (): ViewState => ({
      filters: {
        stage: stageFilter,
        owner: ownerFilter,
        view,
        stages: visibleStages.join(','),
      },
      columns: visibleCols,
      sort,
    }),
    [stageFilter, ownerFilter, view, visibleStages, visibleCols, sort],
  );

  const applyView = useCallback((state: ViewState) => {
    setStageFilter(state.filters.stage ?? '');
    setOwnerFilter(state.filters.owner ?? '');
    if (state.filters.view === 'table' || state.filters.view === 'kanban') {
      setView(state.filters.view);
    }
    const savedStages = (state.filters.stages ?? '')
      .split(',')
      .filter((k) => ALL_STAGE_KEYS.includes(k));
    if (savedStages.length > 0) {
      setStageOrder([...savedStages, ...ALL_STAGE_KEYS.filter((k) => !savedStages.includes(k))]);
      setHiddenStages(ALL_STAGE_KEYS.filter((k) => !savedStages.includes(k)));
    }
    if (state.columns.length > 0) {
      const saved = state.columns.filter((k) => ALL_COLUMN_KEYS.includes(k));
      setColumnOrder([...saved, ...ALL_COLUMN_KEYS.filter((k) => !saved.includes(k))]);
      setHiddenCols(ALL_COLUMN_KEYS.filter((k) => !saved.includes(k)));
    }
    setSort(state.sort);
  }, [setView]);

  const pageCount = Math.max(1, Math.ceil(total / DEAL_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * DEAL_PAGE_SIZE + 1,
    to: Math.min(total, (page + 1) * DEAL_PAGE_SIZE),
    pageRows: deals,
  };

  const showSkeleton = useMinimumVisible(loading);

  const selectedTargets: DealDeleteTarget[] = deals
    .filter((d) => selected.has(d.id))
    .map((d) => ({ id: d.id, displayCode: d.display_code, name: d.name }));

  const settingsIsKanban = view === 'kanban';

  return (
    <>
      <ListPage
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Deals' }]}
        title="Deals"
        icon={<BriefcaseIcon size={32} />}
        description="Deals are the sales opportunities you are working with companies and contacts to close."
        flush
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={submitSearch}
        searchHints={dealSearchHints}
        searchPlaceholder="Search code, deal, company…"
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
            {canEdit && (
              <Button variant="primary" onClick={() => navigate('/sales/deals/new')}>
                <Plus size={20} aria-hidden="true" />
                New Deal
              </Button>
            )}
            <SettingsButton
              label={settingsIsKanban ? 'Stage settings' : 'Column settings'}
              title={
                settingsIsKanban
                  ? 'Choose the stage order and which stage columns show'
                  : 'Choose the column order and which columns show'
              }
              onClick={() => setSettingsOpen(true)}
            />
          </>
        }
        bulkBarOpen={canBulk && view === 'table' && selected.size > 0}
        bulkBar={
          canBulk && view === 'table' ? (
            <BulkBar count={selected.size}>
              <Button
                variant="danger"
                disabled={selectedTargets.length === 0}
                title={selectedTargets.length === 0 ? 'Tick a deal to delete it.' : undefined}
                onClick={() => setDeleting(selectedTargets)}
              >
                <Trash2 size={20} aria-hidden="true" />
                Delete
              </Button>
            </BulkBar>
          ) : undefined
        }
        filterRail={
          <div className="fo-advanced-search-body deals-filter-rail">
            <Select
              label="Stage"
              options={DEAL_STAGES.map((s) => ({
                value: s,
                label: stageLabel(s),
              }))}
              placeholder="All stages"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            />
            <Select
              label="Owner"
              options={staffOptions}
              placeholder="All owners"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            />
          </div>
        }
        exportRows={exportDealRows}
        exportCount={total}
        exportColumns={visibleCols.map((key) => ({ key, header: COLUMN_HEADER[key] ?? key }))}
        exportFilename="deals.csv"
      >
        {notice && (
          <p className="text-secondary fo-bulk-notice" role="status">
            {notice}
          </p>
        )}
        {savedViews.error && (
          <p className="form-error" role="alert">
            {savedViews.error}
          </p>
        )}

        <div className="fo-list-toolbar">
          <SegmentedToggle
            ariaLabel="Deal view"
            value={view}
            onChange={(next) => {
              setView(next);
            }}
            options={[
              { value: 'table', label: '', title: 'Table', icon: <TableIcon size={20} aria-hidden="true" /> },
              { value: 'kanban', label: '', title: 'Kanban', icon: <KanbanIcon size={20} aria-hidden="true" /> },
            ]}
          />
          <Pager
            from={pager.from}
            to={pager.to}
            total={pager.total}
            page={pager.page}
            pageCount={pager.pageCount}
            onPage={pager.setPage}
            disabled={view === 'kanban'}
          />
        </div>

        {moveError && <div className="form-error" role="alert">{moveError}</div>}
        {showSkeleton && view === 'kanban' ? (
          <div className="sales-deals-board">
            <KanbanSkeleton
              label="Loading deal pipeline"
              cards={3}
              stages={visibleStages.map((stage) => ({ key: stage, label: stageLabel(stage) }))}
            />
          </div>
        ) : showSkeleton ? (
          <div className="fo-skeleton-card">
            <Skeleton rows={8} label="Loading deals" />
          </div>
        ) : view === 'kanban' ? (
          <div className="sales-deals-board">
            <KanbanBoard
              stages={visibleStages.map((s) => ({ key: s, label: stageLabel(s) }))}
              cards={kanbanCards}
              onMove={onMove}
              columnExtras={columnExtras}
            />
          </div>
        ) : (
          <Table
            busy={loading}
            columns={columns}
            rows={pager.pageRows}
            rowKey={(d) => d.id}
            sortKey={sort?.key ?? null}
            sortDir={sort?.dir ?? 'asc'}
            onSortChange={(key, dir) => setSort({ key, dir })}
            selectable={canBulk}
            selected={selected}
            onSelectionChange={changeSelection}
            onRowClick={(d) => openRecord(`/sales/deals/${d.id}`)}
            emptyIcon={<BriefcaseIcon size={32} />}
            emptyText="No deals match."
          />
        )}

        {settingsOpen && settingsIsKanban && (
          <ColumnSettingsDialog
            title="Stage settings"
            hint="Drag a stage to change where its column sits on the board, or untick it to hide that column. Save a view to keep this arrangement."
            columns={STAGE_DEFS}
            order={stageOrder}
            hidden={hiddenStages}
            onOrderChange={setStageOrder}
            onToggle={(key) =>
              setHiddenStages(
                hiddenStages.includes(key)
                  ? hiddenStages.filter((k) => k !== key)
                  : [...hiddenStages, key],
              )
            }
            onReset={() => {
              setStageOrder(ALL_STAGE_KEYS);
              setHiddenStages([]);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {settingsOpen && !settingsIsKanban && (
          <ColumnSettingsDialog
            title="Column settings"
            hint="Drag a column to change where it sits, or untick it to hide it. Save a view to keep this arrangement."
            columns={COLUMN_DEFS}
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
              setColumnOrder(ALL_COLUMN_KEYS);
              setHiddenCols([]);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {deleting && (
          <DealDeleteDialog
            targets={deleting}
            onClose={() => setDeleting(null)}
            onDeleted={(count) => {
              setDeleting(null);
              setSelected(new Set());
              setNotice(count === 1 ? '1 deal deleted.' : `${count} deals deleted.`);
              void load();
            }}
          />
        )}
      </ListPage>

      {pendingLost && (
        <LostReasonDialog
          dealLabel={`${pendingLost.display_code} · ${pendingLost.name}`}
          onCancel={() => setPendingLost(null)}
          onConfirm={(reason) => {
            const deal = pendingLost;
            setPendingLost(null);
            void writeStage(deal, 'lost', reason);
          }}
        />
      )}

      {wonNotice && (
        <div
          className="sales-toast"
          data-closing={wonClosing ? 'true' : undefined}
          role="status"
        >
          {wonNotice}
        </div>
      )}
    </>
  );
}
