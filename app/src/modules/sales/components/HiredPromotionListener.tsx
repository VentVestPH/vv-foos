import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useRole } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { useCompanyOptions } from '../hooks';

interface HiredPrompt {
  eventId: string;
  personId: string;
  companyId: string | null;
  hiredAt: string | null;
}

function parsePayload(raw: unknown, eventId: string): HiredPrompt | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  const personId = typeof p.person_id === 'string' ? p.person_id : null;
  if (!personId) return null;
  return {
    eventId,
    personId,
    companyId: typeof p.company_id === 'string' ? p.company_id : null,
    hiredAt: typeof p.hired_at === 'string' ? p.hired_at : null,
  };
}

export function HiredPromotionListener() {
  const role = useRole();
  const navigate = useNavigate();
  const { companyName } = useCompanyOptions();
  const [prompts, setPrompts] = useState<HiredPrompt[]>([]);

  const listening = role === 'admin' || role === 'bd';

  useEffect(() => {
    if (!listening) return;
    const channel = supabase
      .channel('crm-hired-promotions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events_outbox',
          filter: 'event_name=eq.application.hired',
        },
        (message) => {
          const row = message.new as {
            id?: string;
            payload?: unknown;
          };
          const prompt = parsePayload(row.payload, row.id ?? crypto.randomUUID());
          if (prompt) {
            setPrompts((prev) =>
              prev.some((p) => p.eventId === prompt.eventId)
                ? prev
                : [...prev, prompt],
            );
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listening]);

  if (!listening || prompts.length === 0) return null;

  const dismiss = (eventId: string) => {
    setPrompts((prev) => prev.filter((p) => p.eventId !== eventId));
  };

  const current = prompts[0];

  return (
    <div className="sales-promote-banner" role="alert">
      <strong>Candidate hired{
        current.companyId ? ` at ${companyName(current.companyId)}` : ''
      } — add as contact?</strong>
      <span>
        Promoting keeps one identity: a contact profile is added to the same
        person record.
      </span>
      <div className="sales-promote-banner-actions">
        <Button size="sm" onClick={() => dismiss(current.eventId)}>
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const q = new URLSearchParams({ personId: current.personId });
            if (current.companyId) q.set('companyId', current.companyId);
            if (current.hiredAt) q.set('since', current.hiredAt);
            dismiss(current.eventId);
            navigate(`/sales/promote?${q.toString()}`);
          }}
        >
          Review
        </Button>
      </div>
      {prompts.length > 1 && (
        <span className="sales-panel-note">
          {prompts.length - 1} more pending promotion(s)
        </span>
      )}
    </div>
  );
}
