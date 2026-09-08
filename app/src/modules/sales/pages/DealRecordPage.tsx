import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBackToList } from '../../../lib/listReturn';
import { supabase } from '../../../lib/supabase';
import { CURRENCIES } from '../../../lib/format';
import { DEAL_STAGES, type DealStage } from '../../../lib/database.types';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { CircleArrowUp, Briefcase as BriefcaseIcon } from 'lucide-react';
import { EngagementPanel } from '../components/EngagementPanel';
import { LostReasonDialog } from '../components/LostReasonDialog';
import { useCanEditCrm, useCompanyOptions, useStaffList } from '../hooks';
import {
  personName,
  stageLabel,
  type ContactProfile,
  type Deal,
  type Person,
} from '../lib';

export function DealRecordPage() {
  const { id } = useParams<{ id: string }>();
  const backToList = useBackToList('/sales/deals');
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const { record } = useRecentlyViewed();
  const { staffOptions } = useStaffList();
  const { companyOptions } = useCompanyOptions();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [stage, setStage] = useState<DealStage>('lead');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [probability, setProbability] = useState('');
  const [expectedClose, setExpectedClose] = useState('');

  const [companyContacts, setCompanyContacts] = useState<
    { profile: ContactProfile; person: Person }[]
  >([]);
  const [pendingLostReason, setPendingLostReason] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeClosing, setNoticeClosing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    setDeal(data ?? null);
    setLoaded(true);
    if (data) {
      setName(data.name);
      setCompanyId(data.company_id ?? '');
      setContactId(data.primary_contact_id ?? '');
      setOwnerId(data.owner_id ?? '');
      setStage(data.stage);
      setValue(data.value === null ? '' : String(data.value));
      setCurrency(data.currency ?? 'PHP');
      setProbability(data.probability === null ? '' : String(data.probability));
      setExpectedClose(data.expected_close ?? '');
    }
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
    if (!companyId) {
      setCompanyContacts([]);
      return;
    }
    let cancelled = false;
    async function loadContacts(cid: string) {
      const { data: profiles } = await supabase
        .from('contact_profiles')
        .select('*')
        .eq('company_id', cid);
      if (!profiles || profiles.length === 0) {
        if (!cancelled) setCompanyContacts([]);
        return;
      }
      const { data: people } = await supabase
        .from('people')
        .select('*')
        .in(
          'id',
          profiles.map((p) => p.person_id),
        );
      if (cancelled) return;
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      setCompanyContacts(
        profiles
          .map((profile) => ({ profile, person: byId.get(profile.person_id) }))
          .filter(
            (r): r is { profile: ContactProfile; person: Person } =>
              r.person !== undefined,
          ),
      );
    }
    void loadContacts(companyId);
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const contactOptions = useMemo(
    () =>
      companyContacts.map((c) => ({
        value: c.profile.person_id,
        label: personName(c.person),
      })),
    [companyContacts],
  );

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

  const doSave = async (lostReason?: string) => {
    setSaving(true);
    setSaveError(null);
    const patch = {
      name: name.trim(),
      company_id: companyId || null,
      primary_contact_id: contactId || null,
      owner_id: ownerId || null,
      stage,
      value: value === '' ? null : Number(value),
      currency: currency || null,
      probability: probability === '' ? null : Number(probability),
      expected_close: expectedClose || null,
      lost_reason:
        stage === 'lost' ? (lostReason ?? deal.lost_reason) : null,
    };
    const { error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', deal.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    const movedToWon = stage === 'won' && deal.stage !== 'won';
    await load();
    setRefreshKey((k) => k + 1);
    if (movedToWon) setNotice(`${deal.display_code} — won.`);
  };

  const save = () => {
    if (!name.trim()) {
      setSaveError('Deal name is required.');
      return;
    }
    if (stage === 'lost' && deal.stage !== 'lost') {
      setPendingLostReason(true);
      return;
    }
    void doSave();
  };

  return (
    <RecordPage
      code={deal.display_code}
      title={deal.name}
      icon={<BriefcaseIcon size={32} />}
      titleExtras={
        <span className="sales-badges">
          <StatusBadge status={deal.stage} />
          {deal.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      }
      actionBar={
        <>
          <button
            type="button"
            className="link-btn fo-back-to-list"
            onClick={backToList}
          >
            <CircleArrowUp size={20} aria-hidden="true" />
            Back To List
          </button>
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          )}
          {canEdit && saveError !== null && (
            <span className="field-error-text" role="alert">{saveError}</span>
          )}
        </>
      }
    >
      <RecordSection title="Deal details">
        <div className="sales-form-grid">
          <div className="sales-span-2">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <Select
            label="Company"
            options={companyOptions}
            placeholder="No company"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setContactId('');
            }}
            disabled={!canEdit}
          />
          <Select
            label="Primary contact"
            options={contactOptions}
            placeholder={
              companyId ? 'No primary contact' : 'Pick a company first'
            }
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            disabled={!canEdit || !companyId}
          />
          <Select
            label="Owner"
            options={staffOptions}
            placeholder="Unassigned"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={!canEdit}
          />
          <Select
            label="Stage"
            options={DEAL_STAGES.map((s) => ({
              value: s,
              label: stageLabel(s),
            }))}
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStage)}
            disabled={!canEdit}
          />
          <Input
            label="Value"
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!canEdit}
          />
          <Select
            label="Currency"
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={!canEdit}
          />
          <Input
            label="Probability (%)"
            type="number"
            min="0"
            max="100"
            step="1"
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            disabled={!canEdit}
          />
          <DateField
            label="Expected close"
            value={expectedClose}
            onChange={(e) => setExpectedClose(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        {deal.stage === 'lost' && deal.lost_reason && (
          <div className="sales-panel-note">
            Lost reason: {deal.lost_reason}
          </div>
        )}
      </RecordSection>

      <RecordSection title="Activity and engagement">
        <EngagementPanel
          relatedType="deal"
          relatedId={deal.id}
          refreshKey={refreshKey}
        />
      </RecordSection>

      {contactId && (
        <div className="sales-panel-note">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sales/contacts/${contactId}`)}
          >
            Open primary contact record
          </Button>
        </div>
      )}

      {pendingLostReason && (
        <LostReasonDialog
          dealLabel={`${deal.display_code} · ${deal.name}`}
          onCancel={() => setPendingLostReason(false)}
          onConfirm={(reason) => {
            setPendingLostReason(false);
            void doSave(reason);
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
    </RecordPage>
  );
}
