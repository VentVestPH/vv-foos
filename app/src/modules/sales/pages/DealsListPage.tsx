import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { DEAL_STAGES, type Database, type DealStage } from '../../../lib/database.types';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { useListLink } from '../../../lib/listReturn';
import { KanbanBoard } from '../../../components/ui/KanbanBoard';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { LostReasonDialog } from '../components/LostReasonDialog';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Briefcase as BriefcaseIcon } from 'lucide-react';
import { useCanEditCrm, useCompanyOptions, useStaffList } from '../hooks';
import { fmtDate, fmtMoney, stageLabel, type Deal } from '../lib';
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

type DealListRow = Omit<Database['public']['Views']['deal_list']['Row'], 'search_text'>;

function dealLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function dealBaseQuery() {
  return supabase.from('deal_list').select(DEAL_VIEW_COLUMNS, { count: 'exact' });
}

type DealQuery = ReturnType<typeof dealBaseQuery>;

type ViewMode = 'kanban' | 'table';

export function DealsListPage() {
  const navigate = useNavigate();
  const openRecord = useListLink();
  const canEdit = useCanEditCrm();
  const { staffName, staffOptions } = useStaffList();
  const { companyName } = useCompanyOptions();
  const [params] = useSearchParams();

  const [deals, setDeals] = useState<DealListRow[]>([]);
  const [board, setBoard] = useState<Map<string, { cards: DealListRow[]; total: number }>>(
    new Map(),
  );
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState(() => params.get('stage') ?? '');
  const [ownerFilter, setOwnerFilter] = useState(() => params.get('owner_id') ?? '');
  const [companyFilter] = useState(() => params.get('company_id') ?? '');
  const [pendingLost, setPendingLost] = useState<DealListRow | null>(null);
  const [wonNotice, setWonNotice] = useState<string | null>(null);
  const [wonClosing, setWonClosing] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      if (view === 'kanban') {
        const next = new Map<string, { cards: DealListRow[]; total: number }>();
        for (const stage of DEAL_STAGES) {
          if (stageFilter && stage !== stageFilter) {
            next.set(stage, { cards: [], total: 0 });
            continue;
          }
          const { data, count, error } = await applyDealFilters(dealBaseQuery())
            .eq('stage', stage)
            .order('updated_at', { ascending: false })
            .order('id', { ascending: true })
            .range(0, KANBAN_CARDS_PER_STAGE - 1);
          if (error) throw new Error(error.message);
          next.set(stage, { cards: data ?? [], total: count ?? 0 });
        }
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
      setLoading(false);
    }
  }, [view, applyDealFilters, stageFilter, sort, page, beginLoad]);

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
      await load();
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
            {d.probability !== null && ` \u00b7 ${d.probability}%`}
          </span>
          <span>
            {`${fmtDate(d.expected_close)} \u00b7 ${d.owner_name ?? ''}`}
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

  const columns: TableColumn<Deal>[] = [
    { key: 'display_code', header: 'Code', sortable: true },
    {
      key: 'name',
      header: 'Deal',
      sortable: true,
      render: (d) => (
        <span className="sales-badges">
          <strong>{d.name}</strong>
          {d.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      sortValue: (d) => companyName(d.company_id),
      render: (d) => companyName(d.company_id),
    },
    {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      sortValue: (d) => DEAL_STAGES.indexOf(d.stage),
      render: (d) => <StatusBadge status={d.stage} />,
    },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
      sortValue: (d) => d.value ?? 0,
      render: (d) => fmtMoney(d.value, d.currency),
    },
    {
      key: 'probability',
      header: 'Prob.',
      render: (d) => (d.probability === null ? EMPTY_CELL : `${d.probability}%`),
    },
    {
      key: 'expected_close',
      header: 'Expected close',
      sortable: true,
      sortValue: (d) => d.expected_close ?? '',
      render: (d) => fmtDate(d.expected_close),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (d) => staffName(d.owner_id),
      render: (d) => staffName(d.owner_id),
    },
  ];

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
        code: d.display_code,
        name: d.name,
        company: d.company_name ?? '',
        stage: d.stage,
        value: d.value,
        currency: d.currency,
        probability: d.probability,
        expected_close: d.expected_close,
        owner: d.owner_name ?? '',
      }));
  }, [applyDealFilters, total]);

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

  return (
    <>
      <ListPage
        title="Deals"
        icon={<BriefcaseIcon size={32} />}
        description="Deals are the sales opportunities you are working with companies and contacts to close."
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deals…"
        actions={
          <span className="sales-badges">
            <span className="sales-view-toggle" role="group" aria-label="View">
              <button
                type="button"
                className={view === 'kanban' ? 'active' : undefined}
                onClick={() => setView('kanban')}
              >
                Kanban
              </button>
              <button
                type="button"
                className={view === 'table' ? 'active' : undefined}
                onClick={() => setView('table')}
              >
                Table
              </button>
            </span>
            {canEdit && (
              <Button
                variant="primary"
                onClick={() => navigate('/sales/deals/new')}
              >
                New Deal
              </Button>
            )}
          </span>
        }
        filterRail={
            <div className="fo-advanced-search-body">
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
        exportFilename="deals.csv"
      >
        <div className="record-action-bar fo-list-action-bar">
          <PlaceholderAction
            label="Delete"
            detail="Bulk delete isn't implemented for deals yet."
          />
        </div>

        {view === 'table' && (
          <Pager
            from={pager.from}
            to={pager.to}
            total={pager.total}
            page={pager.page}
            pageCount={pager.pageCount}
            onPage={pager.setPage}
          />
        )}

        {moveError && <div className="form-error" role="alert">{moveError}</div>}
        {view === 'kanban' ? (
          <KanbanBoard
            stages={DEAL_STAGES.map((s) => ({ key: s, label: stageLabel(s) }))}
            cards={kanbanCards}
            onMove={onMove}
            columnExtras={columnExtras}
          />
        ) : (
          <Table
            busy={loading}
            columns={columns}
            rows={pager.pageRows}
            rowKey={(d) => d.id}
            sortKey={sort?.key ?? null}
            sortDir={sort?.dir ?? 'asc'}
            onSortChange={(key, dir) => setSort({ key, dir })}
            onRowClick={(d) => openRecord(`/sales/deals/${d.id}`)}
            emptyText="No deals match."
          />
        )}

        {view === 'table' && (
          <Pager
            from={pager.from}
            to={pager.to}
            total={pager.total}
            page={pager.page}
            pageCount={pager.pageCount}
            onPage={pager.setPage}
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
