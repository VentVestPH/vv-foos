import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from './SessionProvider';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const { session, loading } = useSession();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  const signInWithGoogle = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: 'ventvest.com' },
      },
    });
    if (err) setError(err.message);
  };

  const signInWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) setError(err.message);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-mark">VV</span>
          <h1>VentVest Front Office</h1>
          <p className="text-secondary">Sign in with your ventvest.com account.</p>
        </div>

        <Button variant="primary" onClick={signInWithGoogle} fullWidth>
          Continue with Google
        </Button>

        <div className="login-divider">
          <span>or</span>
        </div>

        <form onSubmit={signInWithPassword} className="login-form">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={busy} fullWidth>
            {busy ? 'Signing in…' : 'Sign in with email'}
          </Button>
        </form>
      </div>
    </div>
  );
}
