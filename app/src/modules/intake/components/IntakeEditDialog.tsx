import {
  RecordEditDialog,
  type EditField,
  type EditValue,
} from '../../../components/ui/RecordEditDialog';
import { supabase } from '../../../lib/supabase';
import type { Json } from '../../../lib/database.types';
import { CHANNEL_LABEL, STATUS_LABEL, TARGET_LABEL, canAttachRequisition, type IntakeItem } from '../lib';
import { useOpenRequisitions } from '../hooks';
import { useRole } from '../../../auth/SessionProvider';
import { validateCandidateContact } from '../../../lib/personValidation';

export interface IntakeEditDialogProps {
  item: IntakeItem;
  onClose: () => void;
  onSaved: () => void;
}

const STAR_OPTIONS = ['1', '2', '3'].map((v) => ({
  value: v,
  label: v === '1' ? '1 star' : `${v} stars`,
}));

export function IntakeEditDialog({ item, onClose, onSaved }: IntakeEditDialogProps) {
  const parsed = item.parsed && typeof item.parsed === 'object' && !Array.isArray(item.parsed)
    ? item.parsed as Record<string, unknown>
    : {};
  const parsedText = (key: string) => typeof parsed[key] === 'string' ? parsed[key] as string : '';
  const requiredCandidate = item.target_type === 'candidate';
  const role = useRole();
  const requisitionRequired = requiredCandidate && canAttachRequisition(role);
  const requisitions = useOpenRequisitions(requisitionRequired);
  const fields: EditField[] = [
    { kind: 'text', key: 'full_name', label: 'Name', span: true },
    { kind: 'text', key: 'first_name', label: 'First name' },
    { kind: 'text', key: 'last_name', label: 'Last name' },
    { kind: 'email', key: 'email', label: 'Email', section: 'Candidate contact' },
    { kind: 'text', key: 'phone', label: 'Phone', section: 'Candidate contact' },
    { kind: 'url', key: 'linkedin_url', label: 'LinkedIn URL', span: true },
    ...(requisitionRequired
      ? [{
          kind: 'select' as const,
          key: 'requisition_id',
          label: 'Requisition',
          span: true,
          placeholder: 'Choose a requisition',
          options: requisitions.map((req) => ({ value: req.id, label: `${req.display_code} · ${req.title}` })),
        }]
      : []),
    {
      kind: 'select',
      key: 'target_type',
      label: 'Target',
      options: Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label })),
    },
    {
      kind: 'select',
      key: 'channel',
      label: 'Channel',
      options: Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
    },
    { kind: 'text', key: 'batch_label', label: 'Batch label' },
    { kind: 'select', key: 'star_grade', label: 'Star grade', options: STAR_OPTIONS, placeholder: 'Not graded' },
    { kind: 'textarea', key: 'grade_comment', label: 'Grade comment' },
  ];

  const values: Record<string, EditValue> = {
    full_name: item.full_name ?? '',
    first_name: parsedText('first_name'),
    last_name: parsedText('last_name'),
    email: parsedText('email'),
    phone: parsedText('phone'),
    requisition_id: parsedText('requisition_id'),
    linkedin_url: item.linkedin_url ?? '',
    target_type: item.target_type,
    channel: item.channel,
    status: item.status,
    batch_label: item.batch_label ?? '',
    star_grade: item.star_grade === null ? '' : String(item.star_grade),
    grade_comment: item.grade_comment ?? '',
  };

  const text = (v: EditValue | undefined) => (typeof v === 'string' ? v.trim() || null : null);

  const save = async (draft: Record<string, EditValue>) => {
    const firstName = String(draft.first_name ?? '').trim();
    const lastName = String(draft.last_name ?? '').trim();
    const email = String(draft.email ?? '').trim();
    const phone = String(draft.phone ?? '').trim();
    if (requiredCandidate) {
      const validationError = validateCandidateContact(firstName, lastName, email, phone);
      if (validationError) throw new Error(validationError);
    }
    const requisitionId = String(draft.requisition_id ?? '').trim();
    if (requisitionRequired && !requisitionId) throw new Error('Attach the candidate to a requisition.');
    const nextParsed: Record<string, Json> = { ...(parsed as Record<string, Json>) };
    for (const [key, value] of Object.entries({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      ...(requisitionRequired ? { requisition_id: requisitionId } : {}),
    })) {
      if (value) nextParsed[key] = value;
      else delete nextParsed[key];
    }
    const { error } = await supabase
      .from('intake_items')
      .update({
        full_name: requiredCandidate && firstName && lastName
          ? `${firstName} ${lastName}`
          : text(draft.full_name),
        linkedin_url: text(draft.linkedin_url),
        target_type: String(draft.target_type) as IntakeItem['target_type'],
        channel: String(draft.channel) as IntakeItem['channel'],
        status: String(draft.status) as IntakeItem['status'],
        batch_label: text(draft.batch_label),
        star_grade: draft.star_grade ? Number(draft.star_grade) : null,
        grade_comment: text(draft.grade_comment),
        parsed: nextParsed,
      })
      .eq('id', item.id);
    if (error) throw new Error(error.message);
    onSaved();
  };

  return (
    <RecordEditDialog
      title="Edit intake item"
      fields={fields}
      values={values}
      required={requiredCandidate ? ['first_name', 'last_name', 'email', ...(requisitionRequired ? ['requisition_id'] : [])] : []}
      onClose={onClose}
      onSave={save}
      footNote="The raw payload is what the channel delivered and is kept as received. Editing here changes only the parsed fields the queue works from."
    />
  );
}
