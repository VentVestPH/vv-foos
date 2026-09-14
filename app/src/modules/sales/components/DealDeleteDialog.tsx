import { useEffect, useState } from 'react';
import {
  ConfirmDeleteDialog,
  ConfirmDeleteGroup,
  ConfirmDeleteList,
} from '../../../components/ui/ConfirmDeleteDialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import { supabase } from '../../../lib/supabase';
import { errMsg } from '../../../lib/errMsg';

export interface DealDeleteTarget {
  id: string;
  displayCode: string;
  name: string;
}

export interface DealDeleteDialogProps {
  targets: DealDeleteTarget[];
  onClose: () => void;
  onDeleted: (count: number) => void;
}

async function countActivities(targets: DealDeleteTarget[]): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('activities')
    .select('deal_id')
    .in(
      'deal_id',
      targets.map((t) => t.id),
    );
  if (error) throw new Error(error.message);
  const tally = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.deal_id as string | null;
    if (key) tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return tally;
}

export function DealDeleteDialog({
  targets,
  onClose,
  onDeleted,
}: DealDeleteDialogProps) {
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    countActivities(targets)
      .then((result) => {
        if (live) setCounts(result);
      })
      .catch((e: unknown) => {
        if (live) setError(errMsg(e));
      });
    return () => {
      live = false;
    };
  }, [targets]);

  const remove = async () => {
    const { data, error: err } = await supabase
      .from('deals')
      .delete()
      .in(
        'id',
        targets.map((t) => t.id),
      )
      .select('id');
    if (err) throw new Error(err.message);
    onDeleted((data ?? []).length);
  };

  const totalActivities = [...(counts?.values() ?? [])].reduce((n, c) => n + c, 0);

  return (
    <ConfirmDeleteDialog
      wide
      title={targets.length === 1 ? 'Delete deal' : `Delete ${targets.length} deals`}
      confirmLabel={
        targets.length === 1 ? 'Delete permanently' : `Delete ${targets.length} permanently`
      }
      confirmDisabled={counts === null}
      onClose={onClose}
      onConfirm={remove}
    >
      {counts === null && !error ? (
        <Skeleton rows={3} label="Checking what is logged against these deals" />
      ) : (
        <>
          <ConfirmDeleteGroup
            title={
              targets.length === 1
                ? 'This deal will be deleted'
                : `${targets.length} deals will be deleted`
            }
          >
            <ConfirmDeleteList>
              {targets.map((t) => {
                const n = counts?.get(t.id) ?? 0;
                return (
                  <li key={t.id}>
                    <span className="fo-confirm-name">
                      {t.displayCode} {t.name}
                    </span>
                    {n > 0 && (
                      <span className="text-secondary">
                        {' '}
                        {n === 1 ? '1 activity' : `${n} activities`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ConfirmDeleteList>
          </ConfirmDeleteGroup>
          <p className="text-secondary">
            {totalActivities > 0
              ? `The ${totalActivities === 1 ? 'one activity' : `${totalActivities} activities`} logged against ${targets.length === 1 ? 'it' : 'them'} ${totalActivities === 1 ? 'goes' : 'go'} too. Notes and calls filed against the account or a contact are not affected.`
              : 'Nothing is logged against them. Notes and calls filed against the account or a contact are not affected.'}
          </p>
          <p className="text-secondary">
            Closing a deal as Won or Lost is the usual end state and keeps the history. This cannot
            be undone.
          </p>
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
