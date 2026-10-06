import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from './SessionProvider';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EMAIL_PATTERN } from '../lib/personValidation';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { session, loading } = useSession();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSignupInfo, setShowSignupInfo] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { hd: 'ventvest.com', prompt: 'select_account' },
        },
      });
      if (err) setAuthError(authErrorMessage(err));
    } catch (err) {
      setAuthError(authErrorMessage(err));
    }
  };

  const signInWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? 'Enter your work email address.'
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? 'Enter a valid email address, such as name@company.com.'
        : undefined;
    const nextPasswordError = password ? undefined : 'Enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError) {
      emailRef.current?.focus();
      return;
    }
    if (nextPasswordError) {
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (err) setAuthError(authErrorMessage(err));
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const signingIn = busy || (session !== null && loading);

  return (
    <div className="login-page">
      <header className="login-header">
        <a className="login-header-brand" href="/login" aria-label="VentVest Front Office OS sign in">
          <img src="/ventvest-logo.webp" alt="VentVest" width={1038} height={231} />
        </a>
      </header>

      <main className="login-layout">
        <section className="login-main" aria-labelledby="login-title">
          <div className="login-card">
            <div className="login-brand">
              <span className="login-kicker">FRONT OFFICE OS</span>
              <h1 id="login-title">Welcome back</h1>
              <p className="login-subtitle">Sign in with your work account.</p>
            </div>

            <form onSubmit={signInWithPassword} className="login-form" noValidate>
              <Input
                ref={emailRef}
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(undefined);
                  setAuthError(null);
                }}
                autoComplete="email"
                error={emailError}
                required
              />
              <Input
                ref={passwordRef}
                label="Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(undefined);
                  setAuthError(null);
                }}
                autoComplete="current-password"
                error={passwordError}
                required
              />
              {authError && (
                <p className="login-auth-error" role="alert">
                  {authError}
                </p>
              )}
              <Button type="submit" variant="primary" loading={signingIn} fullWidth>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <Button
              variant="secondary"
              className="login-google-btn"
              onClick={signInWithGoogle}
              fullWidth
            >
              <svg
                className="login-google-mark"
                width="16"
                height="16"
                viewBox="0 0 48 48"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="#ea4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                />
                <path
                  fill="#4285f4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
                />
                <path
                  fill="#fbbc05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
                />
                <path
                  fill="#34a853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                />
              </svg>
              Sign in with Google
            </Button>
          </div>
        </section>

        <aside className="login-aside" aria-labelledby="login-aside-title">
          <div className="login-aside-header">
            <div className="login-signup-wrap">
              <Button
                variant="secondary"
                size="sm"
                className="login-signup"
                aria-expanded={showSignupInfo}
                aria-controls="login-signup-info"
                onClick={() => setShowSignupInfo((shown) => !shown)}
              >
                Sign up
              </Button>
              {showSignupInfo && (
                <p id="login-signup-info" className="login-signup-info" role="status">
                  Ask your VentVest administrator to set up your account.
                </p>
              )}
            </div>
          </div>

          <div className="login-aside-content">
            <div className="login-illustration-frame">
              <img
                className="login-illustration"
                src="/login-panel-placeholder.svg"
                alt="Abstract illustration of connected teams and workspaces"
                width={720}
                height={500}
              />
            </div>
            <div className="login-aside-copy">
              <span className="login-aside-eyebrow">RECRUITING &amp; RELATIONSHIP MANAGEMENT</span>
              <h2 id="login-aside-title">Keep every search and client relationship moving.</h2>
              <p>Manage requisitions, track candidate pipelines, and keep company and contact work in view.</p>
            </div>
          </div>
          <div className="login-aside-footer"><span>RECRUITING · CANDIDATES · REQUISITIONS · CRM</span></div>
        </aside>
      </main>
    </div>
  );
}

function authErrorMessage(error: unknown): string {
  const authError = error && typeof error === 'object'
    ? error as { code?: string; status?: number; message?: string; name?: string }
    : {};
  const code = authError.code?.toLowerCase() ?? '';
  const message = authError.message?.toLowerCase() ?? '';

  if (code === 'invalid_credentials' || code === 'invalid_grant' || message.includes('invalid login credentials')) {
    return 'Email or password is incorrect. Check your details and try again.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Verify your email address before signing in.';
  }
  if (authError.status === 429 || code.includes('rate_limit') || message.includes('too many requests')) {
    return 'Too many sign-in attempts. Wait a moment, then try again.';
  }
  if (authError.name === 'AuthRetryableFetchError' || message.includes('fetch')) {
    return 'We could not reach sign-in. Check your connection and try again.';
  }
  return 'Sign-in is temporarily unavailable. Try again in a moment.';
}
