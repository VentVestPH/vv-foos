import { useEffect, useState } from 'react';
import {
  RecordEditDialog,
  type EditField,
  type EditValue,
} from '../../../components/ui/RecordEditDialog';
import { supabase } from '../../../lib/supabase';
import { CURRENCIES } from '../../../lib/format';
import { DEAL_STAGES, type DealStage } from '../../../lib/database.types';
import { stageLabel, type Deal } from '../lib';

const CONTACT_OPTION_CAP = 500;

const DEAL = 'Deal';
const RELATIONSHIP = 'Relationship';
const VALUE = 'Value and forecast';
const OUTCOME = 'Outcome';

export interface DealEditDialogProps {
  deal: Deal;
  companyOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function dealEditValues(deal: Deal): Record<string, EditValue> {
  return {
    name: deal.name,
    company_id: deal.company_id ?? '',
    primary_contact_id: deal.primary_contact_id ?? '',
    owner_id: deal.owner_id ?? '',
    stage: deal.stage,
    value: deal.value === null ? '' : String(deal.value),
    currency: deal.currency ?? 'PHP',
    probability: deal.probability === null ? '' : String(deal.probability),
    expected_close: deal.expected_close ?? '',
    lost_reason: deal.lost_reason ?? '',
  };
}

export function DealEditDialog({
  deal,
  companyOptions,
  staffOptions,
  onClose,
  onSaved,
}: DealEditDialogProps) {
  const [contactOptions, setContactOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let live = true;
    async function loadContacts() {
      const { data } = await supabase
        .from('contact_list')
        .select('person_id, full_name, company_name')
        .order('last_name', { ascending: true })
        .order('person_id', { ascending: true })
        .range(0, CONTACT_OPTION_CAP - 1);
      if (!live) return;
      setContactOptions(
        (data ?? []).map((r) => ({
          value: r.person_id as string,
          label: r.company_name
            ? `${r.full_name ?? 'Unnamed'} · ${r.company_name}`
            : (r.full_name ?? 'Unnamed'),
        })),
      );
    }
    void loadContacts();
    return () => {
      live = false;
    };
  }, []);

  const fields: EditField[] = [
    { kind: 'text', key: 'name', label: 'Deal name', section: DEAL, span: true },
    {
      kind: 'select',
      key: 'company_id',
      label: 'Company',
      section: RELATIONSHIP,
      options: companyOptions,
      placeholder: 'No company',
    },
    {
      kind: 'select',
      key: 'primary_contact_id',
      label: 'Primary contact',
      section: RELATIONSHIP,
      options: contactOptions,
      placeholder: 'No primary contact',
    },
    {
      kind: 'select',
      key: 'owner_id',
      label: 'Owner',
      section: RELATIONSHIP,
      options: staffOptions,
      placeholder: 'Unassigned',
    },
    { kind: 'number', key: 'value', label: 'Value', section: VALUE },
    {
      kind: 'select',
      key: 'currency',
      label: 'Currency',
      section: VALUE,
      options: CURRENCIES.map((c) => ({ value: c, label: c })),
    },
    { kind: 'number', key: 'probability', label: 'Probability (%)', section: VALUE },
    { kind: 'date', key: 'expected_close', label: 'Expected close', section: VALUE },
    {
      kind: 'select',
      key: 'stage',
      label: 'Stage',
      section: OUTCOME,
      options: DEAL_STAGES.map((s) => ({ value: s, label: stageLabel(s) })),
    },
    {
      kind: 'textarea',
      key: 'lost_reason',
      label: 'Lost reason',
      section: OUTCOME,
      span: true,
      placeholder: 'Why the deal was lost. Kept only while the stage is Closed Lost.',
    },
  ];

  const save = async (draft: Record<string, EditValue>) => {
    const text = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string) : '');
    const stage = text('stage') as DealStage;
    const patch = {
      name: text('name').trim(),
      company_id: text('company_id') || null,
      primary_contact_id: text('primary_contact_id') || null,
      owner_id: text('owner_id') || null,
      stage,
      value: text('value') === '' ? null : Number(text('value')),
      currency: text('currency') || null,
      probability: text('probability') === '' ? null : Number(text('probability')),
      expected_close: text('expected_close') || null,
      lost_reason: stage === 'lost' ? text('lost_reason').trim() || null : null,
    };
    const { error } = await supabase.from('deals').update(patch).eq('id', deal.id);
    if (error) throw new Error(error.message);
    onSaved();
  };

  return (
    <RecordEditDialog
      title="Edit deal"
      fields={fields}
      values={dealEditValues(deal)}
      required={['name']}
      footNote="A lost reason is kept only while the stage is Closed Lost. Moving the deal out of that stage clears it."
      onClose={onClose}
      onSave={save}
    />
  );
}
