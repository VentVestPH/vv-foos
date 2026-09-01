import { Check, Minus } from 'lucide-react';

/**
 * C7/D13. These were the text glyphs U+2713 and an em dash used as status
 * marks. Same class as the Timeline emoji map: a character standing in for an
 * icon. aria-label carries the meaning, since a bare mark is not readable.
 */
function ScopeMark({ granted }: { granted: boolean }) {
  const Icon = granted ? Check : Minus;
  return (
    <Icon
      size={14}
      strokeWidth={1.6}
      aria-label={granted ? 'Granted' : 'Not granted'}
    />
  );
}

// Agent 6 — Settings surface, instruction 12: "connect button, scope status,
// label picker, sync indicator, template manager." This card covers the
// connect/disconnect + scope-status half; label picker and template manager
// are noted as follow-ups in the module README (they read/write
// integration_settings rows Agent 6's brief describes but aren't part of
// the OAuth/sync/send critical path).
//
// NOT YET LIVE-TESTABLE end-to-end: google-oauth-start/callback need
// GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI set as function secrets first
// (see VVPH_VV-FOOS_Doc_Google-OAuth-Setup). The status/disconnect calls
// below work today against the deployed get_my_google_status /
// disconnect_my_google RPCs regardless.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from './db';
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
    const { data, error: err } = await db.rpc('get_my_google_status');
    if (err) setError(err.message);
    else setStatus((data as GoogleTokensSummary | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  // google-oauth-callback redirects back here with ?google=connected|error.
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
    const { data, error: err } = await db.functions.invoke('google-oauth-start', {
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
    const { error: err } = await db.rpc('disconnect_my_google');
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
