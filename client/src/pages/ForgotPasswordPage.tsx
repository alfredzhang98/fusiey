import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, ApiError } from '../services/api';

/**
 * Two-step password reset:
 *   1. Enter email → a 6-digit code is emailed.
 *   2. Enter the code + a new password → password is reset, then sign in.
 *
 * The request step always reports success (the server never reveals whether
 * an email is registered), so we advance to step 2 regardless.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setStep('reset');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword({ email: email.trim(), code: code.trim(), newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'h-10 px-3 bg-paper-warm border-[2px] border-ink/25 focus:border-ink rounded-[10px] font-body text-sm outline-none transition-colors';

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div
        className="w-full max-w-md p-8 bg-paper border-[3px] border-ink rounded-[20px]"
        style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
      >
        {done ? (
          <div className="text-center py-4">
            <h1 className="font-cute font-bold text-ink text-2xl mb-2">Password updated ✨</h1>
            <p className="font-body text-ink-hint text-sm">Taking you to sign in…</p>
          </div>
        ) : step === 'request' ? (
          <>
            <h1 className="font-cute font-bold text-ink text-2xl mb-1 text-center">Forgot password</h1>
            <p className="font-body text-ink-hint text-sm text-center mb-6">
              Enter your email and we'll send a 6-digit reset code.
            </p>
            <form onSubmit={requestCode} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
              {error && <p className="font-body text-[12px] text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="h-11 mt-2 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold rounded-pill border-[2px] border-ink disabled:opacity-50"
                style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
              >
                {busy ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-cute font-bold text-ink text-2xl mb-1 text-center">Reset password</h1>
            <p className="font-body text-ink-hint text-sm text-center mb-6">
              We sent a code to <span className="font-semibold text-ink">{email}</span>. Enter it below with your new password.
            </p>
            <form onSubmit={resetPassword} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
                6-digit code
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className={`${inputClass} tracking-[0.5em] text-center font-pixel-mono`}
                />
              </label>
              <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
                New password (8+ chars)
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 font-body text-[12px] text-ink-soft">
                Confirm new password
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </label>
              {error && <p className="font-body text-[12px] text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="h-11 mt-2 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold rounded-pill border-[2px] border-ink disabled:opacity-50"
                style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
              >
                {busy ? 'Resetting…' : 'Reset password'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('request'); setError(null); }}
                className="font-body text-[12px] text-ink-hint hover:text-ink underline"
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        <p className="font-body text-[12px] text-ink-hint text-center mt-6">
          Remembered it?{' '}
          <Link to="/login" className="text-ink font-semibold underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
