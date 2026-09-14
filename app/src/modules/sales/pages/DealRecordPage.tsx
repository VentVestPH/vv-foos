import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useListReturnHref } from '../../../lib/listReturn';
import { supabase } from '../../../lib/supabase';
import { EMPTY_CELL } from '../../../lib/format';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import {
  Briefcase as BriefcaseIcon,
  Building2,
  PencilLine,
  UserRound,
} from 'lucide-react';
import { EngagementPanel } from '../components/EngagementPanel';
import { DealDeleteDialog } from '../components/DealDeleteDialog';
import { DealEditDialog } from '../components/DealEditDialog';
import { ActionMenu } from '../../../components/ui/ActionMenu';
import { useCanEditCrm, useCompanyOptions, useStaffList } from '../hooks';
import { fmtDate, fmtMoney, personName, type Deal, type Person } from '../lib';

export function DealRecordPage() {
  const { id } = useParams<{ id: string }>();
  const listHref = useListReturnHref('/sales/deals');
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const { record } = useRecentlyViewed();
  const { staffName, staffOptions } = useStaffList();
  const { companyName, companyOptions } = useCompanyOptions();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contact, setContact] = useState<Person | null>(null);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dealActivityCount, setDealActivityCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeClosing, setNoticeClosing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    setDeal(data ?? null);
    setLoaded(true);
    const { count } = await supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', id);
    setDealActivityCount(count ?? 0);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (deal) {
      record({
        type: 'deal',
        id: deal.id,
        label: `${deal.display_code} ${deal.name}`,
        href: `/sales/deals/${deal.id}`,
      });
    }
  }, [deal, record]);

  useEffect(() => {
    const contactId = deal?.primary_contact_id;
    if (!contactId) {
      setContact(null);
      return;
    }
    let cancelled = false;
    async function loadContact(pid: string) {
      const { data } = await supabase
        .from('people')
        .select('*')
        .eq('id', pid)
        .maybeSingle();
      if (!cancelled) setContact(data ?? null);
    }
    void loadContact(contactId);
    return () => {
      cancelled = true;
    };
  }, [deal?.primary_contact_id]);

  useEffect(() => {
    if (!notice) return;
    setNoticeClosing(false);
    const fade = setTimeout(() => setNoticeClosing(true), 3860);
    const t = setTimeout(() => setNotice(null), 4000);
    return () => {
      clearTimeout(fade);
      clearTimeout(t);
    };
  }, [notice]);

  if (!id) return null;
  if (loaded && !deal) {
    return (
      <div className="stub-panel">
        <h1>Deal not found</h1>
      </div>
    );
  }
  if (!deal) return null;

  return (
    <RecordPage
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Deals', to: listHref },
        { label: deal.display_code },
      ]}
      code={deal.display_code}
      title={deal.name}
      icon={<BriefcaseIcon size={32} />}
      titleExtras={
        <span className="sales-badges">
          <StatusBadge status={deal.stage} />
          {deal.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      }
      headerMeta={
        (deal.company_id || deal.primary_contact_id) && (
          <div className="sales-record-links">
            {deal.company_id && (
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate(`/sales/companies/${deal.company_id}`)}
              >
                <Building2 size={20} aria-hidden="true" />
                {companyName(deal.company_id)}
              </button>
            )}
            {deal.primary_contact_id && (
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate(`/sales/contacts/${deal.primary_contact_id}`)}
              >
                <UserRound size={20} aria-hidden="true" />
                {contact ? personName(contact) : 'Primary contact'}
              </button>
            )}
          </div>
        )
      }
      actionBar={
        canEdit ? (
          <>
            <Button size="sm" onClick={() => setEditing(true)}>
              <PencilLine size={20} aria-hidden="true" />
              Edit
            </Button>
            <ActionMenu
              label="More actions"
              iconOnly
              items={[
                {
                  label: 'Delete permanently…',
                  destructive: true,
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
          </>
        ) : undefined
      }
    >
      <RecordSection title="Deal details">
        <dl className="sales-record-meta">
          <div>
            <dt>Value</dt>
            <dd>{fmtMoney(deal.value, deal.currency)}</dd>
          </div>
          <div>
            <dt>Probability</dt>
            <dd>{deal.probability === null ? EMPTY_CELL : `${deal.probability}%`}</dd>
          </div>
          <div>
            <dt>Expected close</dt>
            <dd>{fmtDate(deal.expected_close)}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{staffName(deal.owner_id)}</dd>
          </div>
        </dl>
        {deal.stage === 'lost' && deal.lost_reason && (
          <div className="sales-panel-note">Lost reason: {deal.lost_reason}</div>
        )}
      </RecordSection>

      <RecordSection title="Activity and engagement">
        <EngagementPanel
          relatedType="deal"
          relatedId={deal.id}
          refreshKey={refreshKey}
        />
      </RecordSection>

      {editing && (
        <DealEditDialog
          deal={deal}
          companyOptions={companyOptions}
          staffOptions={staffOptions}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
            setRefreshKey((k) => k + 1);
            setNotice(`${deal.display_code} saved.`);
          }}
        />
      )}

      {notice && (
        <div
          className="sales-toast"
          data-closing={noticeClosing ? 'true' : undefined}
          role="status"
        >
          {notice}
        </div>
      )}
      {deleting && (
        <DealDeleteDialog
          dealId={deal.id}
          displayCode={deal.display_code}
          name={deal.name}
          activityCount={dealActivityCount}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            navigate(listHref);
          }}
        />
      )}
    </RecordPage>
  );
}
