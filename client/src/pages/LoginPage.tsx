import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { GOOGLE_ENABLED } from '../config/google';
import { useAuthStore } from '../store/useAuthStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextPath = new URLSearchParams(location.search).get('next') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await login(email, password);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div
        className="w-full max-w-md p-8 bg-paper border-[3px] border-ink rounded-[20px]"
        style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
      >
        <h1 className="font-cute font-bold text-ink text-2xl mb-1 text-center">Welcome back</h1>
        <p className="font-body text-ink-hint text-sm text-center mb-6">
          Sign in to save patterns & earn points.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 px-3 bg-paper-warm border-[2px] border-ink/25 focus:border-ink rounded-[10px] font-body text-sm outline-none transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-10 px-3 bg-paper-warm border-[2px] border-ink/25 focus:border-ink rounded-[10px] font-body text-sm outline-none transition-colors"
            />
          </label>
          <div className="text-right -mt-1">
            <Link to="/forgot-password" className="font-body text-[11px] text-ink-hint hover:text-ink underline">
              Forgot password?
            </Link>
          </div>
          {localError && (
            <p className="font-body text-[12px] text-red-600">{localError}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-11 mt-2 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold rounded-pill border-[2px] border-ink disabled:opacity-50"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {GOOGLE_ENABLED && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[1px] bg-ink/20" />
              <span className="font-body text-[11px] text-ink-hint uppercase tracking-wider">or</span>
              <div className="flex-1 h-[1px] bg-ink/20" />
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (r) => {
                  if (!r.credential) return;
                  setBusy(true);
                  setLocalError(null);
                  try {
                    await loginWithGoogle(r.credential);
                    navigate(nextPath, { replace: true });
                  } catch (err: any) {
                    setLocalError(err.message || 'Google login failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                onError={() => setLocalError('Google login failed')}
                width={360}
              />
            </div>
          </>
        )}

        <p className="font-body text-[12px] text-ink-hint text-center mt-6">
          No account?{' '}
          <Link to="/register" className="text-ink font-semibold underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
