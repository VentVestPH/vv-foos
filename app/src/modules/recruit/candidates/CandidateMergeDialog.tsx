import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '../components/Dialog';
import { type Person, errMsg, personEmails, personName } from '../lib';

interface Candidate {
  id: string;
  name: string;
  email: string;
  headline: string;
  location: string;
}

export interface CandidateMergeDialogProps {
  survivor: Person;
  onClose: () => void;
  onMerged: () => Promise<void>;
}

function describe(person: Person): Candidate {
  return {
    id: person.id,
    name: personName(person),
    email: personEmails(person)[0]?.address ?? '',
    headline: person.headline ?? '',
    location: [person.city, person.state, person.country].filter(Boolean).join(', '),
  };
}

export function CandidateMergeDialog({ survivor, onClose, onMerged }: CandidateMergeDialogProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (needle: string) => {
      const term = needle.replace(/[,()%_*]/g, ' ').trim();
      if (term.length < 2) {
        setMatches([]);
        return;
      }
      const like = `%${term}%`;
      const { data, error: err } = await supabase
        .from('people')
        .select('*')
        .or(`first_name.ilike.${like},last_name.ilike.${like}`)
        .neq('id', survivor.id)
        .limit(10);
      if (err) {
        setError(err.message);
        return;
      }
      const ids = (data ?? []).map((p) => p.id);
      if (!ids.length) {
        setMatches([]);
        return;
      }
      const profiles = await supabase
        .from('candidate_profiles')
        .select('person_id')
        .in('person_id', ids);
      const candidateIds = new Set((profiles.data ?? []).map((p) => p.person_id));
      setMatches((data ?? []).filter((p) => candidateIds.has(p.id)).map(describe));
    },
    [survivor.id],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  const merge = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('fn_merge_candidates', {
        p_survivor: survivor.id,
        p_duplicate: chosen.id,
      });
      if (err) throw new Error(err.message);
      onClose();
      await onMerged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const keeper = describe(survivor);

  return (
    <Dialog
      title="Merge a duplicate into this record"
      onClose={onClose}
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" disabled={!chosen || busy} onClick={() => void merge()}>
            {busy ? 'Merging…' : 'Merge and delete the duplicate'}
          </Button>
        </>
      )}
    >
      <p className="text-secondary">
        This record is kept. The one you choose is deleted, and its applications, activities, tasks,
        reminders and files move here. Nothing already filled in on this record is overwritten.
      </p>

      <Input
        label="Find the duplicate by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {matches.length > 0 && (
        <div className="field">
          <span className="field-label">Duplicate</span>
          <ul className="merge-match-list">
            {matches.map((match) => (
              <li key={match.id}>
                <label className="checkline">
                  <input
                    type="radio"
                    name="merge-duplicate"
                    checked={chosen?.id === match.id}
                    onChange={() => setChosen(match)}
                  />
                  <span>
                    <strong>{match.name}</strong>
                    <span className="text-secondary">
                      {[match.email, match.headline, match.location].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {query.trim().length >= 2 && matches.length === 0 && (
        <p className="text-secondary">No other candidate matches that name.</p>
      )}

      {chosen && (
        <table className="table merge-compare">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Kept</th>
              <th scope="col">Merged in</th>
            </tr>
          </thead>
          <tbody>
            {(['name', 'email', 'headline', 'location'] as const).map((field) => (
              <tr key={field}>
                <th scope="row">{field}</th>
                <td>{keeper[field] || '—'}</td>
                <td>{chosen[field] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <span className="field-error-text" role="alert">{error}</span>}
    </Dialog>
  );
}
