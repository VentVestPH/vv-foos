import { useEffect, useState } from 'react';
import {
  ConfirmDeleteDialog,
  ConfirmDeleteGroup,
  ConfirmDeleteList,
} from '../../../components/ui/ConfirmDeleteDialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import { supabase } from '../../../lib/supabase';
import { errMsg } from '../../../lib/errMsg';

const DEPENDENTS = [
  { table: 'requisitions', noun: 'requisition' },
  { table: 'deals', noun: 'deal' },
  { table: 'contact_profiles', noun: 'contact' },
  { table: 'tickets', noun: 'ticket' },
  { table: 'activities', noun: 'activity', plural: 'activities' },
] as const;

export interface CompanyDeleteTarget {
  id: string;
  name: string;
}

interface Blocked {
  id: string;
  name: string;
  reasons: string[];
}

interface Survey {
  removable: CompanyDeleteTarget[];
  blocked: Blocked[];
}

function countLabel(count: number, noun: string, plural?: string): string {
  return `${count} ${count === 1 ? noun : (plural ?? `${noun}s`)}`;
}

async function surveyCompanies(targets: CompanyDeleteTarget[]): Promise<Survey> {
  const ids = targets.map((t) => t.id);
  const counts = new Map<string, string[]>();

  await Promise.all(
    DEPENDENTS.map(async (dep) => {
      const { data, error } = await supabase
        .from(dep.table)
        .select('company_id')
        .in('company_id', ids);
      if (error) throw new Error(error.message);
      const tally = new Map<string, number>();
      for (const row of data ?? []) {
        const key = row.company_id as string | null;
        if (key) tally.set(key, (tally.get(key) ?? 0) + 1);
      }
      for (const [id, n] of tally) {
        const list = counts.get(id) ?? [];
        list.push(countLabel(n, dep.noun, 'plural' in dep ? dep.plural : undefined));
        counts.set(id, list);
      }
    }),
  );

  const removable: CompanyDeleteTarget[] = [];
  const blocked: Blocked[] = [];
  for (const target of targets) {
    const reasons = counts.get(target.id);
    if (reasons && reasons.length > 0) {
      blocked.push({ ...target, reasons });
    } else {
      removable.push(target);
    }
  }
  return { removable, blocked };
}

export interface CompanyDeleteDialogProps {
  targets: CompanyDeleteTarget[];
  onClose: () => void;
  onDeleted: (count: number) => void;
}

export function CompanyDeleteDialog({ targets, onClose, onDeleted }: CompanyDeleteDialogProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    surveyCompanies(targets)
      .then((result) => {
        if (live) setSurvey(result);
      })
      .catch((e: unknown) => {
        if (live) setError(errMsg(e));
      });
    return () => {
      live = false;
    };
  }, [targets]);

  const removable = survey?.removable ?? [];
  const blocked = survey?.blocked ?? [];

  const remove = async () => {
    const { error: err } = await supabase
      .from('companies')
      .delete()
      .in(
        'id',
        removable.map((t) => t.id),
      );
    if (err) throw new Error(err.message);
    onDeleted(removable.length);
  };

  return (
    <ConfirmDeleteDialog
      wide
      title={targets.length === 1 ? 'Delete account' : `Delete ${targets.length} accounts`}
      confirmLabel={
        removable.length === 1 ? 'Delete permanently' : `Delete ${removable.length} permanently`
      }
      confirmDisabled={survey === null || removable.length === 0}
      confirmTitle={
        survey !== null && removable.length === 0
          ? 'Every account selected still has records attached to it'
          : undefined
      }
      onClose={onClose}
      onConfirm={remove}
    >
      {survey === null && !error ? (
        <Skeleton rows={3} label="Checking what is attached to these accounts" />
      ) : (
        <>
          {removable.length > 0 && (
            <ConfirmDeleteGroup
              title={
                removable.length === 1
                  ? 'This account will be deleted'
                  : `${removable.length} accounts will be deleted`
              }
            >
              <ConfirmDeleteList>
                {removable.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ConfirmDeleteList>
              <p className="text-secondary">Nothing else references them. This cannot be undone.</p>
            </ConfirmDeleteGroup>
          )}
          {blocked.length > 0 && (
            <ConfirmDeleteGroup
              title={blocked.length === 1 ? 'This one is kept' : `${blocked.length} are kept`}
            >
              <ConfirmDeleteList>
                {blocked.map((b) => (
                  <li key={b.id}>
                    <span className="fo-confirm-name">{b.name}</span>
                    <span className="text-secondary"> {b.reasons.join(', ')}</span>
                  </li>
                ))}
              </ConfirmDeleteList>
              <p className="text-secondary">
                Deleting an account cascades to everything that points at it, so these would take
                their requisitions, deals, contacts and history with them. Move or close those
                records first.
              </p>
            </ConfirmDeleteGroup>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </ConfirmDeleteDialog>
  );
}
