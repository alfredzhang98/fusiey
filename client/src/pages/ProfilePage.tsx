import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Mail, Calendar, Shield, Key, Edit2, X, Check,
  Palette, Star, Loader2, ArrowRight, Package, Eye, EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { ConfirmDialog } from '../components/ConfirmDialog';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Avatar — Google profile picture (needs no-referrer to load) with a graceful
 *  fallback to the default icon if there's no URL or the image fails. */
function Avatar({ url }: { url?: string | null }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        className="w-full h-full object-cover"
      />
    );
  }
  return <User className="w-8 h-8 text-ink" />;
}

export function ProfilePage() {
  const { user, updateProfile, changePassword, logout } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  // Password change fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  if (!user) return null;

  const isGoogleOnly = !user.hasPassword;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

  const openEdit = () => {
    setName(user.name);
    setEmail(user.email);
    setError(null);
    setOkMsg(null);
    setEditOpen(true);
  };

  const handleUpdateProfile = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await updateProfile({ name: name.trim() || undefined, email: email.trim() || undefined });
      setOkMsg('Profile updated');
      setEditOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await changePassword({ currentPassword: currentPw, newPassword: newPw });
      setOkMsg('Password changed');
      setPwOpen(false);
      setCurrentPw('');
      setNewPw('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  // Clear ok message after 3s
  if (okMsg) {
    setTimeout(() => setOkMsg(null), 3000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <h1 className="font-cute font-bold text-ink text-3xl mb-8">My Profile</h1>

      {/* Success toast */}
      <AnimatePresence>
        {okMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3 bg-mint/30 border-[2px] border-ink rounded-[12px] flex items-center gap-2 text-ink font-cute font-semibold text-sm"
          >
            <Check className="w-4 h-4" />
            {okMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── User info card ─────────────────────────────────────────────── */}
      <div className="fsy-card space-y-5">
        {/* Avatar + basics */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-butter border-[3px] border-ink flex items-center justify-center shrink-0 overflow-hidden">
            <Avatar url={user.avatarUrl} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-cute font-bold text-ink text-xl truncate">{user.name}</h2>
              {isAdmin && (
                <span className="fsy-tag bg-cotton text-[10px]">
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>
            <div className="space-y-1 mt-1.5">
              <p className="font-body text-ink-soft text-sm flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
                {user.emailVerified && (
                  <span className="text-mint text-[10px] font-semibold">Verified</span>
                )}
              </p>
              <p className="font-body text-ink-hint text-xs flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Member since {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={openEdit}
            className="fsy-btn fsy-btn-sm bg-paper gap-1.5 shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>

        {/* Community points — the rewards system ships later. */}
        <div className="flex items-center gap-3 p-3 bg-paper-warm border-[2px] border-ink/20 rounded-[12px]">
          <div className="w-9 h-9 rounded-full bg-butter border-[2px] border-ink flex items-center justify-center shrink-0">
            <Star className="w-4 h-4 text-ink" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-cute font-bold text-ink text-base leading-none">{user.communityPoints}</div>
            <div className="font-body text-ink-hint text-[11px] mt-1">Community Points</div>
          </div>
          <span className="fsy-tag bg-paper text-[9px] text-ink-hint">Coming soon</span>
        </div>

        {/* Google link status */}
        {isGoogleOnly && (
          <div className="flex items-center gap-2 p-2.5 bg-butter/30 border border-ink/20 rounded-[10px] text-ink-soft font-body text-xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Signed in with Google · No password set
          </div>
        )}
      </div>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        <Link
          to="/orders"
          className="fsy-card p-4 flex items-center gap-4 hover:bg-butter/30 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-sky-candy/30 border-[2px] border-ink flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-ink" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-cute font-semibold text-ink text-sm">My Orders</p>
            <p className="font-body text-ink-hint text-xs">Track your purchases</p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-hint group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          to="/my-works"
          className="fsy-card p-4 flex items-center gap-4 hover:bg-butter/30 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-cotton/30 border-[2px] border-ink flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-ink" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-cute font-semibold text-ink text-sm">My Works</p>
            <p className="font-body text-ink-hint text-xs">Saved bead patterns</p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-hint group-hover:translate-x-0.5 transition-transform" />
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            className="fsy-card p-4 flex items-center gap-4 hover:bg-butter/30 transition-colors group sm:col-span-2"
          >
            <div className="w-10 h-10 rounded-full bg-ink/10 border-[2px] border-ink flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-cute font-semibold text-ink text-sm">Admin Panel</p>
              <p className="font-body text-ink-hint text-xs">Manage products, orders, and inventory</p>
            </div>
            <ArrowRight className="w-4 h-4 text-ink-hint group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {/* ── Edit profile modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !busy && setEditOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm bg-paper border-[3px] border-ink rounded-[20px] p-6 space-y-4"
              style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-cute font-bold text-ink text-lg">Edit Profile</h3>
                <button
                  onClick={() => setEditOpen(false)}
                  className="w-7 h-7 rounded-full border-[2px] border-ink/30 flex items-center justify-center hover:bg-butter transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-ink" />
                </button>
              </div>

              <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                Display Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="fsy-input"
                  maxLength={80}
                />
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="fsy-input"
                />
              </label>

              {error && (
                <p className="font-body text-xs text-red-600">{error}</p>
              )}

              <button
                onClick={handleUpdateProfile}
                disabled={busy}
                className="fsy-btn bg-cotton w-full"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Change password section ────────────────────────────────────── */}
      {!isGoogleOnly && (
        <div className="mt-6">
          <button
            onClick={() => { setPwOpen(!pwOpen); setError(null); setOkMsg(null); }}
            className="flex items-center gap-2 font-cute font-semibold text-sm text-ink-hint hover:text-ink transition-colors"
          >
            <Key className="w-4 h-4" />
            {pwOpen ? 'Cancel password change' : 'Change password'}
          </button>

          <AnimatePresence>
            {pwOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="fsy-card mt-3 space-y-3">
                  <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                    Current Password
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      className="fsy-input"
                    />
                  </label>
                  <label className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                    New Password (8+ characters)
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="fsy-input w-full pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-hint hover:text-ink"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </label>
                  {error && <p className="font-body text-xs text-red-600">{error}</p>}
                  <button
                    onClick={handleChangePassword}
                    disabled={busy || !currentPw || newPw.length < 8}
                    className="fsy-btn bg-cotton w-full disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Danger zone ────────────────────────────────────────────────── */}
      <div className="mt-10 pt-6 border-t-[2px] border-ink/20">
        <button
          onClick={() => setSignOutOpen(true)}
          className="fsy-btn bg-paper border-red-300 text-red-600 hover:bg-red-50"
        >
          Sign Out
        </button>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        message="You'll need to sign in again to access your account."
        confirmLabel="Sign out"
        onConfirm={() => { setSignOutOpen(false); logout(); }}
        onCancel={() => setSignOutOpen(false)}
      />
    </div>
  );
}
