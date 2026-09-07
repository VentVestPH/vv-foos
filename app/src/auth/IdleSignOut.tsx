import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const IDLE_LIMIT_MS = 60 * 60 * 1000;
const IDLE_WARNING_MS = 2 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'foos.lastActivity';
const TICK_MS = 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

function now(): number {
  return Date.now();
}

function readLastActivity(): number {
  try {
    const stored = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : now();
  } catch {
    return now();
  }
}

function writeLastActivity(at: number): void {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    return;
  }
}

export function IdleSignOut() {
  const lastActivity = useRef(readLastActivity());
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const markActive = useCallback(() => {
    lastActivity.current = now();
    writeLastActivity(lastActivity.current);
    setRemainingMs(null);
  }, []);

  useEffect(() => {
    markActive();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') markActive();
    };
    document.addEventListener('visibilitychange', onVisible);

    const tick = window.setInterval(() => {
      const idleFor = now() - Math.max(lastActivity.current, readLastActivity());
      const left = IDLE_LIMIT_MS - idleFor;
      if (left <= 0) {
        window.clearInterval(tick);
        void supabase.auth.signOut();
        return;
      }
      setRemainingMs(left <= IDLE_WARNING_MS ? left : null);
    }, TICK_MS);

    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
    };
  }, [markActive]);

  if (remainingMs === null) return null;

  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return (
    <div className="fo-placeholder-overlay" role="presentation">
      <div
        className="fo-placeholder-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fo-idle-title"
        aria-describedby="fo-idle-body"
      >
        <div className="fo-placeholder-titlebar" id="fo-idle-title">
          Still there?
        </div>
        <div className="fo-placeholder-body" id="fo-idle-body">
          You have been idle for a while. For the safety of candidate records, this session signs
          out in {seconds} second{seconds === 1 ? '' : 's'}. Anything already saved is unaffected.
        </div>
        <div className="fo-placeholder-footer">
          <button type="button" className="btn btn-primary btn-sm" onClick={markActive} autoFocus>
            Keep me signed in
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
