import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '../components/Dialog';
import { errMsg } from '../lib';

export interface CandidateBulkSubmitDialogProps {
  personIds: string[];
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}

const REQUISITION_MATCH_LIMIT = 12;
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

export function CandidateBulkSubmitDialog({
  personIds,
  onClose,
  onSubmitted,
}: CandidateBulkSubmitDialogProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<RequisitionMatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    const { data: existing, error: readErr } = await supabase
      .from('applications')
      .select('person_id')
      .eq('requisition_id', requisitionId)
      .in('person_id', personIds);
    if (readErr) {
      setBusy(null);
      setError(readErr.message);
      return;
    }

    const already = new Set((existing ?? []).map((row) => row.person_id));
    const fresh = personIds.filter((id) => !already.has(id));

    if (fresh.length > 0) {
      const { error: insertErr } = await supabase.from('applications').insert(
        fresh.map((personId) => ({
          requisition_id: requisitionId,
          person_id: personId,
          stage: 'submitted' as const,
        })),
      );
      if (insertErr) {
        setBusy(null);
        setError(insertErr.message);
        return;
      }
    }

    if (already.size > 0) {
      const { error: updateErr } = await supabase
        .from('applications')
        .update({ stage: 'submitted' })
        .eq('requisition_id', requisitionId)
        .in('person_id', [...already]);
      if (updateErr) {
        setBusy(null);
        setError(updateErr.message);
        return;
      }
    }

    setBusy(null);
    await onSubmitted();
    onClose();
  };

  return (
    <Dialog title="Submit to a requisition" className="cand-submit-dialog" onClose={onClose}>
      <Input
        label="Search requisitions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Code, title, company…"
        autoFocus
      />
      <p className="text-secondary">
        {personIds.length} selected. Each keeps its own application; one already on a requisition
        moves to submitted rather than gaining a second.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="panel-stack">
        {matches.map((req) => (
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
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={busy !== null}
                onClick={() => void submit(req.id)}
              >
                Submit
              </Button>
            </div>
          </div>
        ))}
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
