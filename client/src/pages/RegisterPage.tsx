import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { GOOGLE_ENABLED } from '../config/google';
import { useAuthStore } from '../store/useAuthStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, loginWithGoogle } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextPath = new URLSearchParams(location.search).get('next') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setLocalError('Please agree to our Terms and Privacy Policy to continue.');
      return;
    }
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
          Get started in seconds.
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
          <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className={`h-10 px-3 bg-paper-warm border-[2px] rounded-[10px] font-body text-sm outline-none transition-colors ${
                confirmPassword && confirmPassword !== password
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-ink/25 focus:border-ink'
              }`}
            />
            {confirmPassword && confirmPassword !== password && (
              <span className="text-red-500 text-[11px]">Passwords don't match</span>
            )}
          </label>
          <label className="flex items-start gap-2 font-body text-[12px] text-ink-soft cursor-pointer select-none mt-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[color:var(--color-ink)] shrink-0"
            />
            <span>
              I agree to Fusiey's{' '}
              <Link to="/legal/terms" target="_blank" className="text-ink font-semibold underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/legal/privacy" target="_blank" className="text-ink font-semibold underline">Privacy Policy</Link>.
            </span>
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
                    setLocalError(err.message || 'Google signup failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                onError={() => setLocalError('Google signup failed')}
                width="100%"
              />
            </div>
          </>
        )}

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
