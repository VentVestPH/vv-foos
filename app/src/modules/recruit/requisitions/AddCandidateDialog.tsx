import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '../components/Dialog';
import { fetchPeopleByIds } from '../hooks';
import {
  type Application,
  type CandidateProfile,
  type Person,
  type Requisition,
  errMsg,
  personName,
} from '../lib';

export interface AddCandidateDialogProps {
  requisition: Requisition;
  existing: Application[];
  onClose: () => void;
  onAdded: () => Promise<void>;
  onDuplicate: (app: Application) => void;
}

export function AddCandidateDialog({
  requisition,
  existing,
  onClose,
  onAdded,
  onDuplicate,
}: AddCandidateDialogProps) {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error: err } = await supabase
          .from('candidate_profiles')
          .select('*');
        if (err) throw new Error(err.message);
        if (cancelled) return;
        const rows = data ?? [];
        setProfiles(rows);
        const persons = await fetchPeopleByIds(rows.map((r) => r.person_id));
        if (!cancelled) {
          setPeople(new Map(persons.map((p) => [p.id, p] as [string, Person])));
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const matches = profiles
    .filter((prof) => {
      const p = people.get(prof.person_id);
      if (!p) return false;
      if (!q) return true;
      const hay = `${personName(p)} ${prof.current_title ?? ''} ${
        prof.current_employer ?? ''
      }`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 12);

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
          const p = people.get(prof.person_id);
          if (!p) return null;
          return (
            <div key={prof.person_id} className="panel-item">
              <div className="panel-item-head">
                <span className="panel-item-title">{personName(p)}</span>
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
