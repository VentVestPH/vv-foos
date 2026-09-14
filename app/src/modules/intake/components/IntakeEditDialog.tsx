import {
  RecordEditDialog,
  type EditField,
  type EditValue,
} from '../../../components/ui/RecordEditDialog';
import { supabase } from '../../../lib/supabase';
import { CHANNEL_LABEL, STATUS_LABEL, TARGET_LABEL, type IntakeItem } from '../lib';

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
  const fields: EditField[] = [
    { kind: 'text', key: 'full_name', label: 'Name', span: true },
    { kind: 'url', key: 'linkedin_url', label: 'LinkedIn URL', span: true },
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
    const { error } = await supabase
      .from('intake_items')
      .update({
        full_name: text(draft.full_name),
        linkedin_url: text(draft.linkedin_url),
        target_type: String(draft.target_type) as IntakeItem['target_type'],
        channel: String(draft.channel) as IntakeItem['channel'],
        status: String(draft.status) as IntakeItem['status'],
        batch_label: text(draft.batch_label),
        star_grade: draft.star_grade ? Number(draft.star_grade) : null,
        grade_comment: text(draft.grade_comment),
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
      onClose={onClose}
      onSave={save}
      footNote="The raw payload is what the channel delivered and is kept as received. Editing here changes only the parsed fields the queue works from."
    />
  );
}
