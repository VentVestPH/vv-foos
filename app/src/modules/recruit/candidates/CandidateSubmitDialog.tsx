import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '../components/Dialog';
import { type Person, errMsg } from '../lib';

export interface CandidateSubmitDialogProps {
  person: Person;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}

const REQUISITION_MATCH_LIMIT = 12;
const EXISTING_APPLICATION_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 200;
const SUBMITTABLE_STATUSES = ['open', 'waiting_approval', 'on_hold'] as const;

interface RequisitionMatch {
  id: string;
  display_code: string;
  title: string;
  status: string;
  company_name: string | null;
  location: string | null;
}

interface ExistingApplication {
  requisition_id: string;
  display_code: string;
  stage: string;
}

export function CandidateSubmitDialog({ person, onClose, onSubmitted }: CandidateSubmitDialogProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<RequisitionMatch[]>([]);
  const [existing, setExisting] = useState<ExistingApplication[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: err } = await supabase
        .from('applications')
        .select('requisition_id, display_code, stage')
        .eq('person_id', person.id)
        .order('applied_at', { ascending: false })
        .limit(EXISTING_APPLICATION_LIMIT);
      if (cancelled) return;
      if (err) setError(err.message);
      else setExisting(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [person.id]);

  useEffect(() => {
    let cancelled = false;
    const term = query.trim().toLowerCase();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          let q = supabase
            .from('requisition_list')
            .select('id, display_code, title, status, company_name, location')
            .in('status', SUBMITTABLE_STATUSES)
            .order('opened_date', { ascending: false, nullsFirst: false })
            .order('display_code', { ascending: false })
            .limit(REQUISITION_MATCH_LIMIT);
          if (term) q = q.ilike('search_text', `%${term.replace(/([\\%_])/g, '\\$1')}%`);
          const { data, error: err } = await q;
          if (err) throw new Error(err.message);
          if (!cancelled) {
            setMatches(data ?? []);
            setLoaded(true);
          }
        } catch (e) {
          if (!cancelled) {
            setError(errMsg(e));
            setLoaded(true);
          }
        }
      })();
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const submit = async (requisitionId: string) => {
    setBusy(requisitionId);
    setError(null);

    const already = existing.find((app) => app.requisition_id === requisitionId);
    const { error: err } = already
      ? await supabase
          .from('applications')
          .update({ stage: 'submitted' })
          .eq('person_id', person.id)
          .eq('requisition_id', requisitionId)
      : await supabase.from('applications').insert({
          requisition_id: requisitionId,
          person_id: person.id,
          stage: 'submitted',
        });

    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    await onSubmitted();
    onClose();
  };

  return (
    <Dialog
      title="Submit to a requisition"
      className="cand-submit-dialog"
      onClose={onClose}
    >
      <Input
        label="Search requisitions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Code, title, company…"
        autoFocus
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="panel-stack">
        {matches.map((req) => {
          const already = existing.find((app) => app.requisition_id === req.id);
          const submitted = already?.stage === 'submitted';
          return (
            <div key={req.id} className="panel-item">
              <div className="cand-submit-row">
                <div className="cand-submit-text">
                  <span className="panel-item-title">
                    {req.display_code} · {req.title}
                  </span>
                  <p className="panel-item-body">
                    {[req.company_name, req.location, req.status.replace(/_/g, ' ')]
                      .filter(Boolean)
                      .join(' · ')}
                    {already && !submitted
                      ? ` · already on this requisition at ${already.stage.replace(/_/g, ' ')}`
                      : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={submitted || busy !== null}
                  title={
                    submitted
                      ? 'Already submitted on this requisition'
                      : already
                        ? `Move this application from ${already.stage.replace(/_/g, ' ')} to submitted`
                        : 'Create the application and submit it'
                  }
                  onClick={() => void submit(req.id)}
                >
                  {submitted ? 'Submitted' : already ? 'Move to submitted' : 'Submit'}
                </Button>
              </div>
            </div>
          );
        })}
        {loaded && matches.length === 0 && (
          <p className="text-secondary">
            No open requisition matches that search. Only open, waiting-approval and on-hold
            requisitions can be submitted to.
          </p>
        )}
      </div>
    </Dialog>
  );
}
