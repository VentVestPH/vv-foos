import { Check, Minus } from 'lucide-react';

function ScopeMark({ granted }: { granted: boolean }) {
  const Icon = granted ? Check : Minus;
  return (
    <Icon
      size={14}

      aria-label={granted ? 'Granted' : 'Not granted'}
    />
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { scopeLabel, hasScope, type GoogleTokensSummary } from './lib';

export function GoogleIntegrationCard() {
  const [status, setStatus] = useState<GoogleTokensSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  async function reload() {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_my_google_status');
    if (err) setError(err.message);
    else setStatus((data as GoogleTokensSummary | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const google = params.get('google');
    if (!google) return;
    if (google === 'connected') void reload();
    if (google === 'error') setError(`Google connection failed: ${params.get('reason') ?? 'unknown reason'}`);
    const next = new URLSearchParams(params);
    next.delete('google');
    next.delete('reason');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function connect(tier: 'base' | 'send' | 'calendar') {
    setBusy(tier);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('google-oauth-start', {
      body: { tier },
    });
    setBusy(null);
    if (err || !data?.url) {
      setError(err?.message ?? 'Could not start Google connection — see console for detail.');
      return;
    }
    window.location.href = data.url as string;
  }

  async function disconnect() {
    if (!confirm('Disconnect Google? Sync, send, and meeting-creation will stop until reconnected.')) return;
    setBusy('disconnect');
    const { error: err } = await supabase.rpc('disconnect_my_google');
    setBusy(null);
    if (err) setError(err.message);
    else await reload();
  }

  const connected = !!status;

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2>Google (Gmail + Calendar)</h2>
        <span className={`settings-status-pill ${connected ? 'on' : 'off'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {error && <p className="settings-error">{error}</p>}

      {loading ? (
        <p className="text-secondary">Loading…</p>
      ) : (
        <>
          {connected ? (
            <>
              <ul className="settings-scope-list">
                <li className={hasScope(status, 'base') ? 'on' : 'off'}>
                  <ScopeMark granted={hasScope(status, 'base')} /> {scopeLabel('https://www.googleapis.com/auth/gmail.readonly')}
                </li>
                <li className={hasScope(status, 'send') ? 'on' : 'off'}>
                  <ScopeMark granted={hasScope(status, 'send')} /> {scopeLabel('https://www.googleapis.com/auth/gmail.send')}
                </li>
                <li className={hasScope(status, 'calendar') ? 'on' : 'off'}>
                  <ScopeMark granted={hasScope(status, 'calendar')} /> {scopeLabel('https://www.googleapis.com/auth/calendar.events')}
                </li>
              </ul>
              {status?.connected_at && (
                <p className="text-secondary settings-meta">
                  Connected {new Date(status.connected_at).toLocaleDateString()}
                </p>
              )}
              <div className="settings-card-actions">
                {!hasScope(status, 'send') && (
                  <Button size="sm" onClick={() => connect('send')} disabled={busy === 'send'}>
                    {busy === 'send' ? 'Opening Google…' : 'Grant send access'}
                  </Button>
                )}
                {!hasScope(status, 'calendar') && (
                  <Button size="sm" onClick={() => connect('calendar')} disabled={busy === 'calendar'}>
                    {busy === 'calendar' ? 'Opening Google…' : 'Grant calendar access'}
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={disconnect} disabled={busy === 'disconnect'}>
                  {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-secondary">
                Connect your Google account to sync Gmail and Calendar activity onto candidate and
                contact records, send email as yourself, and create Meet meetings — all from
                inside FOOS.
              </p>
              <div className="settings-card-actions">
                <Button variant="primary" onClick={() => connect('base')} disabled={busy === 'base'}>
                  {busy === 'base' ? 'Opening Google…' : 'Connect Google account'}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
