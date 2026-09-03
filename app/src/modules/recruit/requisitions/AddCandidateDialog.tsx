import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '../components/Dialog';
import {
  type Application,
  type Requisition,
  errMsg,
  personName,
} from '../lib';
import type { CandidateListRow } from '../candidates/candidateRows';

export interface AddCandidateDialogProps {
  requisition: Requisition;
  existing: Application[];
  onClose: () => void;
  onAdded: () => Promise<void>;
  onDuplicate: (app: Application) => void;
}

const CANDIDATE_MATCH_LIMIT = 12;

type CandidateMatch = Pick<
  CandidateListRow,
  'person_id' | 'first_name' | 'middle_name' | 'last_name' | 'current_title' | 'current_employer' | 'source_id'
>;

export function AddCandidateDialog({
  requisition,
  existing,
  onClose,
  onAdded,
  onDuplicate,
}: AddCandidateDialogProps) {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<CandidateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const term = query.trim().toLowerCase();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          let q = supabase
            .from('candidate_list')
            .select('person_id, first_name, middle_name, last_name, current_title, current_employer, source_id')
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true })
            .limit(CANDIDATE_MATCH_LIMIT);
          if (term) q = q.ilike('search_text', `%${term.replace(/([\\%_])/g, '\\$1')}%`);
          const { data, error: err } = await q;
          if (err) throw new Error(err.message);
          if (!cancelled) setProfiles(data ?? []);
        } catch (e) {
          if (!cancelled) setError(errMsg(e));
        }
      })();
    }, term ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const matches = profiles;

  const add = async (personId: string, sourceId: string | null) => {
    setBusy(true);

    const dupe = existing.find((a) => a.person_id === personId);
    if (dupe) {
      onDuplicate(dupe);
      return;
    }
    const { error: err } = await supabase.from('applications').insert({
      requisition_id: requisition.id,
      person_id: personId,
      stage: 'received',
      source_id: sourceId,
    });
    setBusy(false);
    if (err) {
      if (err.code === '23505') {
        const { data } = await supabase
          .from('applications')
          .select('*')
          .eq('requisition_id', requisition.id)
          .eq('person_id', personId)
          .maybeSingle();
        if (data) {
          onDuplicate(data);
          return;
        }
      }
      setError(err.message);
    } else {
      await onAdded();
    }
  };

  return (
    <Dialog title={`Add candidate to ${requisition.display_code}`} onClose={onClose}>
      <Input
        label="Search candidates"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name, title, employer…"
        autoFocus
      />
      {error && <p className="rq-error">{error}</p>}
      <div className="panel-stack">
        {matches.map((prof) => {
          return (
            <div key={prof.person_id} className="panel-item">
              <div className="panel-item-head">
                <span className="panel-item-title">{personName({ ...prof, headline: null })}</span>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void add(prof.person_id, prof.source_id)}
                >
                  Add
                </Button>
              </div>
              <p className="panel-item-body">
                {[prof.current_title, prof.current_employer]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          );
        })}
        {matches.length === 0 && (
          <p className="text-secondary">No matching candidates.</p>
        )}
      </div>
    </Dialog>
  );
}
