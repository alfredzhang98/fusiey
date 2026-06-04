import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/useAuthStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, loginWithGoogle } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextPath = new URLSearchParams(location.search).get('next') || '/designer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await register(email, password, name);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed');
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
        <h1 className="font-cute font-bold text-ink text-2xl mb-1 text-center">Create account</h1>
        <p className="font-body text-ink-hint text-sm text-center mb-6">
          3 free AI generations to get started.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
            Display name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={80}
              className="h-10 px-3 bg-paper-warm border-[2px] border-ink/25 focus:border-ink rounded-[10px] font-body text-sm outline-none transition-colors"
            />
          </label>
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
            Password (8+ chars)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-10 px-3 bg-paper-warm border-[2px] border-ink/25 focus:border-ink rounded-[10px] font-body text-sm outline-none transition-colors"
            />
          </label>
          {localError && (
            <p className="font-body text-[12px] text-red-600">{localError}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-11 mt-2 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold rounded-pill border-[2px] border-ink disabled:opacity-50"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

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
                setLocalError(err.message || 'Google signup failed');
              } finally {
                setBusy(false);
              }
            }}
            onError={() => setLocalError('Google signup failed')}
            width="100%"
          />
        </div>

        <p className="font-body text-[12px] text-ink-hint text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-ink font-semibold underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
