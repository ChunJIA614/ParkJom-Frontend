import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Camera,
  Car,
  CalendarClock,
  CheckCircle2,
  Heart,
  LifeBuoy,
  Loader2,
  Save,
  ShieldAlert,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { showAlert, showConfirm } from '@/contexts/ModalContext';
import {
  deactivateMyAccount,
  getMyProfile,
  removeProfilePicture,
  updateMyProfile,
  uploadProfilePicture,
  validateProfilePicture,
} from '../api/profileApi';
import { mergeProfileIntoSession } from '../lib/session';
import { USER_TYPE_LABELS, type UserProfile, type UserProfileResult } from '../types';

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

type BusyAction = 'load' | 'save' | 'upload' | 'remove' | 'deactivate' | null;

const currency = (value: number) => `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

const inputClass = 'w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] text-[#1d1d1f] transition-colors focus:border-[var(--workspace-accent,#007AFF)] focus:outline-none focus:ring-2 focus:ring-[var(--workspace-accent-soft,#e8f0fe)] disabled:bg-[#f5f5f7] disabled:text-[#8e8e93]';

export default function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const token = user?.token ?? '';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phoneNumber: user?.phoneNumber ?? '',
  }));
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateAcknowledged, setDeactivateAcknowledged] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const applyResult = useCallback((result: UserProfileResult) => {
    setProfile(result.profile);
    setForm({
      firstName: result.profile.firstName,
      lastName: result.profile.lastName,
      phoneNumber: result.profile.phoneNumber,
    });
    setImageFailed(false);
    setUser(user ? mergeProfileIntoSession(user, result.profile, result.jwtToken) : null);
  }, [setUser, user]);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setBusy('load');
    setError(null);
    try {
      const result = await getMyProfile(token);
      setProfile(result.profile);
      setForm({
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        phoneNumber: result.profile.phoneNumber,
      });
      setImageFailed(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your profile.');
    } finally {
      setBusy(null);
    }
  }, [token]);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    setShowDeactivate(false);
    setDeactivateReason('');
    setDeactivateAcknowledged(false);
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phoneNumber: user.phoneNumber ?? '',
    });
    void loadProfile();
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    // Load once per open; loadProfile identity changes when the session token refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose, open]);

  if (!open || !user) return null;

  const runAction = async (action: Exclude<BusyAction, null | 'load'>, task: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const isDirty = Boolean(profile) && (
    form.firstName.trim() !== profile!.firstName
    || form.lastName.trim() !== profile!.lastName
    || form.phoneNumber.trim() !== profile!.phoneNumber
  );

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.phoneNumber.trim()) {
      setError('First name and phone number are required.');
      return;
    }
    void runAction('save', async () => {
      const result = await updateMyProfile(token, form);
      applyResult(result);
      setNotice(result.message || 'Profile updated.');
    });
  };

  const handleFileChange = (file?: File) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    const validationError = validateProfilePicture(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    void runAction('upload', async () => {
      const result = await uploadProfilePicture(token, file);
      applyResult(result);
      setNotice(result.message || 'Profile picture updated.');
    });
  };

  const handleRemovePicture = async () => {
    const confirmed = await showConfirm({
      title: 'Remove profile picture',
      message: 'Your profile picture will be removed and your initials will be shown instead.',
      confirmText: 'Remove',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;
    void runAction('remove', async () => {
      const result = await removeProfilePicture(token);
      applyResult(result);
      setNotice(result.message || 'Profile picture removed.');
    });
  };


  const handleDeactivate = async () => {
    if (!deactivateAcknowledged) return;
    const confirmed = await showConfirm({
      title: 'Deactivate account',
      message: 'This will sign you out and your owned parking spots will be unpublished. You will need to contact ParkJom support to reactivate. Continue?',
      confirmText: 'Deactivate',
      cancelText: 'Keep account',
      variant: 'danger',
      icon: 'danger',
    });
    if (!confirmed) return;

    void runAction('deactivate', async () => {
      const message = await deactivateMyAccount(token, deactivateReason);
      onClose();
      logout();
      navigate('/', { replace: true });
      void showAlert({ title: 'Account deactivated', message, variant: 'info', icon: 'info' });
    });
  };

  const displayName = profile?.fullName || `${user.firstName} ${user.lastName}`.trim() || user.email;
  const pictureUrl = profile?.profilePictureURL ?? user.picture;
  const initials = (profile?.firstName?.charAt(0) || user.firstName?.charAt(0) || user.email.charAt(0) || '?').toUpperCase();
  const userType = profile?.userType ?? (user.userType as 1 | 2 | 3);
  const summary = profile?.summary;
  const isAdmin = userType === 1;
  const isBusy = busy !== null;

  const metrics = summary ? [
    { label: 'Wallet balance', value: currency(summary.walletBalance), icon: Wallet, hint: summary.walletOnHold > 0 ? `${currency(summary.walletOnHold)} on hold` : undefined },
    ...(userType === 2
      ? [{ label: 'Owned spots', value: String(summary.ownedParkingSpotsCount), icon: Building2 }]
      : [{ label: 'Vehicles', value: String(summary.vehicleCount), icon: Car }]),
    { label: 'Active bookings', value: String(summary.activeBookingsCount), icon: CalendarClock, hint: `${summary.totalBookingsCount} total` },
    ...(userType === 3 ? [{ label: 'Favourites', value: String(summary.favoritesCount), icon: Heart }] : []),
    { label: 'Open tickets', value: String(summary.openSupportTicketsCount), icon: LifeBuoy },
  ] : [];

  return createPortal(
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-900/40 backdrop-blur-xs sm:items-center sm:p-4">
      <button type="button" aria-label="Close profile" className="absolute inset-0 cursor-default" onClick={() => !isBusy && onClose()} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#f5f5f7] shadow-[0_24px_60px_rgba(15,23,42,0.25)] sm:max-w-2xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-black/[0.06] bg-white px-5 py-4">
          <div>
            <h2 id="profile-dialog-title" className="text-[16px] font-semibold text-[#1d1d1f]">My profile</h2>
            <p className="text-[11px] text-[#6e6e73]">Manage your personal details, role, and account.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="rounded-full p-2 text-[#6e6e73] transition-colors hover:bg-black/[0.05] hover:text-[#1d1d1f] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              {!profile && busy !== 'load' && (
                <button type="button" onClick={() => void loadProfile()} className="font-semibold underline underline-offset-2">Retry</button>
              )}
            </div>
          )}
          {notice && (
            <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Identity card */}
          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                {pictureUrl && !imageFailed ? (
                  <img src={pictureUrl} alt="" onError={() => setImageFailed(true)} className="h-20 w-20 rounded-full object-cover ring-1 ring-black/[0.08]" />
                ) : (
                  <span
                    className="flex h-20 w-20 items-center justify-center rounded-full text-[26px] font-bold ring-1 ring-black/[0.08]"
                    style={{ backgroundColor: 'var(--workspace-accent-soft, #e8f0fe)', color: 'var(--workspace-accent, #007AFF)' }}
                  >
                    {initials}
                  </span>
                )}
                {(busy === 'upload' || busy === 'remove') && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                    <Loader2 size={20} className="animate-spin text-[#007AFF]" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="truncate text-[17px] font-semibold text-[#1d1d1f]">{displayName}</p>
                <p className="truncate text-[12px] text-[#6e6e73]">{profile?.email ?? user.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  <span className="rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#007AFF]">
                    {profile?.roleName || USER_TYPE_LABELS[userType]}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    (profile?.accountStatus ?? 'Active').toLowerCase() === 'active' ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#fefce8] text-[#a16207]'
                  }`}>
                    {profile?.accountStatus ?? 'Active'}
                  </span>
                  {profile && !profile.isProfileComplete && (
                    <span className="rounded-full bg-[#fff7ed] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c2410c]">Incomplete</span>
                  )}
                </div>
                {profile?.createdAt && <p className="mt-2 text-[10px] text-[#8e8e93]">Member since {formatDate(profile.createdAt)}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleFileChange(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy || !profile}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7] disabled:opacity-50"
                >
                  <Camera size={14} /> {pictureUrl ? 'Change' : 'Upload'}
                </button>
                {pictureUrl && (
                  <button
                    type="button"
                    onClick={() => void handleRemovePicture()}
                    disabled={isBusy || !profile}
                    aria-label="Remove profile picture"
                    className="inline-flex items-center rounded-full border border-black/[0.08] bg-white px-2.5 py-2 text-[#d70015] transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-[#8e8e93] sm:text-left">JPG, PNG, or WEBP · up to 5 MB</p>
          </div>

          {/* Activity summary */}
          {busy === 'load' && !profile ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-black/[0.06] bg-white py-10 text-[12px] text-[#6e6e73]">
              <Loader2 size={16} className="animate-spin" /> Loading your profile…
            </div>
          ) : metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {metrics.map(({ label, value, icon: Icon, hint }) => (
                <div key={label} className="rounded-2xl border border-black/[0.06] bg-white p-3">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                    <span>{label}</span>
                    <Icon size={14} className="text-[var(--workspace-accent,#007AFF)]" />
                  </div>
                  <p className="mt-1.5 text-[16px] font-semibold text-[#1d1d1f]">{value}</p>
                  {hint && <p className="mt-0.5 text-[10px] text-[#8e8e93]">{hint}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Personal details */}
          <form onSubmit={handleSave} className="space-y-3 rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">
              <UserRound size={15} className="text-[var(--workspace-accent,#007AFF)]" /> Personal details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-[#6e6e73]">First name</span>
                <input className={inputClass} value={form.firstName} maxLength={100} autoComplete="given-name" disabled={!profile || isBusy}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-[#6e6e73]">Last name</span>
                <input className={inputClass} value={form.lastName} maxLength={100} autoComplete="family-name" disabled={!profile || isBusy}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-[#6e6e73]">Phone number</span>
                <input className={inputClass} type="tel" value={form.phoneNumber} maxLength={20} autoComplete="tel" placeholder="e.g. 0123456789" disabled={!profile || isBusy}
                  onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-[#6e6e73]">Email</span>
                <input className={inputClass} value={profile?.email ?? user.email} disabled readOnly />
              </label>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!isDirty || isBusy}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--workspace-accent,#007AFF)] px-4 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save changes
              </button>
            </div>
          </form>

          {/* Account role (Single fixed role) */}
          {profile && (
            <div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">
                  <UserRound size={15} className="text-[var(--workspace-accent,#007AFF)]" /> Account role
                </h3>
                <p className="mt-1 text-[11px] text-[#6e6e73]">
                  You are registered as a <strong>{USER_TYPE_LABELS[userType]}</strong>. Each account is assigned a single fixed role.
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-medium text-[#1d1d1f]">
                {USER_TYPE_LABELS[userType]}
              </span>
            </div>
          )}

          {/* Danger zone */}
          {!isAdmin && profile && (
            <div className="rounded-2xl border border-rose-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#d70015]">
                    <ShieldAlert size={15} /> Deactivate account
                  </h3>
                  <p className="mt-1 text-[11px] text-[#6e6e73]">
                    Not possible while you have active or upcoming confirmed bookings. Owned parking spots will be unpublished.
                  </p>
                </div>
                {!showDeactivate && (
                  <button
                    type="button"
                    onClick={() => setShowDeactivate(true)}
                    disabled={isBusy}
                    className="shrink-0 rounded-full border border-rose-200 px-4 py-2 text-[12px] font-semibold text-[#d70015] transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    Deactivate…
                  </button>
                )}
              </div>
              {showDeactivate && (
                <div className="mt-4 space-y-3 border-t border-rose-100 pt-4">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-[#6e6e73]">Reason (optional)</span>
                    <textarea
                      value={deactivateReason}
                      onChange={(event) => setDeactivateReason(event.target.value)}
                      maxLength={500}
                      rows={3}
                      disabled={isBusy}
                      placeholder="Tell us why you are leaving"
                      className={`${inputClass} resize-none`}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-[11px] text-[#3a3a3c]">
                    <input
                      type="checkbox"
                      checked={deactivateAcknowledged}
                      onChange={(event) => setDeactivateAcknowledged(event.target.checked)}
                      disabled={isBusy}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#d70015]"
                    />
                    I understand I will be signed out and lose access to my ParkJom account.
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowDeactivate(false); setDeactivateAcknowledged(false); setDeactivateReason(''); }}
                      disabled={isBusy}
                      className="rounded-full px-4 py-2 text-[12px] font-semibold text-[#6e6e73] hover:bg-black/[0.04] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeactivate()}
                      disabled={!deactivateAcknowledged || isBusy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#d70015] px-4 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {busy === 'deactivate' && <Loader2 size={14} className="animate-spin" />}
                      Deactivate account
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
