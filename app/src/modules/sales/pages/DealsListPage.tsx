import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db as supabase } from '../db';
import { DEAL_STAGES, type DealStage } from '../../../lib/database.types';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { KanbanBoard } from '../../../components/ui/KanbanBoard';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager, usePagination } from '../../../components/ui/Pager';
import { LostReasonDialog } from '../components/LostReasonDialog';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Briefcase as BriefcaseIcon } from 'lucide-react';
import { useCanEditCrm, useCompanyOptions, useStaffList } from '../hooks';
import { fmtDate, fmtMoney, stageLabel, type Deal } from '../lib';
import { EMPTY_CELL } from '../../../lib/format';

type ViewMode = 'kanban' | 'table';

export function DealsListPage() {
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const { staffName, staffOptions } = useStaffList();
  const { companyName } = useCompanyOptions();
  const [params] = useSearchParams();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState(() => params.get('stage') ?? '');
  const [ownerFilter, setOwnerFilter] = useState(() => params.get('owner_id') ?? '');
  const [companyFilter] = useState(() => params.get('company_id') ?? '');
  const [pendingLost, setPendingLost] = useState<Deal | null>(null);
  const [wonNotice, setWonNotice] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deals')
      .select('*')
      .order('updated_at', { ascending: false });
    setDeals(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!wonNotice) return;
    const t = setTimeout(() => setWonNotice(null), 4000);
    return () => clearTimeout(t);
  }, [wonNotice]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (q && !`${d.display_code} ${d.name}`.toLowerCase().includes(q)) {
        return false;
      }
      if (stageFilter && d.stage !== stageFilter) return false;
      if (ownerFilter && d.owner_id !== ownerFilter) return false;
      if (companyFilter && d.company_id !== companyFilter) return false;
      return true;
    });
  }, [deals, search, stageFilter, ownerFilter, companyFilter]);

  const writeStage = async (deal: Deal, toStage: DealStage, lostReason?: string) => {
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
    setDeals((prev) =>
      prev.map((d) => (d.id === deal.id ? { ...d, ...patch } : d)),
    );
    if (toStage === 'won') {
      setWonNotice(`${deal.display_code} · ${deal.name} — won.`);
    }
  };

  const onMove = (dealId: string, toStage: string) => {
    if (!canEdit) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === toStage) return;
    if (toStage === 'lost') {
      setPendingLost(deal);
      return;
    }
    void writeStage(deal, toStage as DealStage);
  };

  const kanbanCards = visible.map((d) => ({
    id: d.id,
    stage: d.stage,
    content: (
      <div
        className="sales-kanban-card"
        onClick={() => navigate(`/sales/deals/${d.id}`)}
      >
        <span className="sales-kanban-card-code">
          {d.display_code}
          {d.is_test && (
            <>
              {' '}
              <Badge tone="warning">TEST</Badge>
            </>
          )}
        </span>
        <span className="sales-kanban-card-name">{d.name}</span>
        <span>{companyName(d.company_id)}</span>
        <span className="sales-kanban-card-value">
          {fmtMoney(d.value, d.currency)}
          {d.probability !== null && ` · ${d.probability}%`}
        </span>
        <span>
          {fmtDate(d.expected_close)} · {staffName(d.owner_id)}
        </span>
      </div>
    ),
  }));

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

  const exportRows = visible
    .filter((d) => !d.is_test)
    .map((d) => ({
      code: d.display_code,
      name: d.name,
      company: companyName(d.company_id),
      stage: d.stage,
      value: d.value,
      currency: d.currency,
      probability: d.probability,
      expected_close: d.expected_close,
      owner: staffName(d.owner_id),
    }));

  const pager = usePagination(visible);

  return (
    <>
      <ListPage
        title="Deals: Home"
        icon={<BriefcaseIcon size={40} />}
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
          <details className="fo-advanced-search" open>
            <summary>Advanced Search</summary>
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
          </details>
        }
        exportRows={exportRows}
        exportFilename="deals.csv"
      >
        <div className="record-action-bar fo-list-action-bar">
          {}
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

        {moveError && <div className="form-error">{moveError}</div>}
        {view === 'kanban' ? (
          <KanbanBoard
            stages={DEAL_STAGES.map((s) => ({ key: s, label: stageLabel(s) }))}
            cards={kanbanCards}
            onMove={onMove}
          />
        ) : (
          <Table
            busy={loading}
            columns={columns}
            rows={pager.pageRows}
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate(`/sales/deals/${d.id}`)}
            emptyText={loading ? 'Loading…' : 'No deals match.'}
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
        <div className="sales-toast" role="status">
          {wonNotice}
        </div>
      )}
    </>
  );
}
