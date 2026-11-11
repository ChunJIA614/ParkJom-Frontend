import { useMemo, useState } from 'react';
import { Bluetooth, CheckCircle2, KeyRound, Loader2, Radio, ShieldCheck, Unlock } from 'lucide-react';
import {
  bindIoTDevice,
  generateIoTBindingOtp,
  ownerUnlockParkingSpot,
  registerIoTDevice,
} from '@/services/iotManagementApi';
import type { ParkingBay } from '../types';

interface OwnerIoTManagerProps {
  token: string;
  bays: ParkingBay[];
  baysLoading: boolean;
  baysError: string | null;
  onRefreshBays: () => void;
}

type Action = 'register' | 'otp' | 'bind' | 'unlock';
type Feedback = { tone: 'success' | 'error'; message: string } | null;

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-white/10 dark:bg-[#18181C] dark:text-white dark:focus:ring-blue-900/40';

export default function OwnerIoTManager({
  token,
  bays,
  baysLoading,
  baysError,
  onRefreshBays,
}: OwnerIoTManagerProps) {
  const [parkingSpotId, setParkingSpotId] = useState<number | ''>('');
  const [deviceUuid, setDeviceUuid] = useState('');
  const [otp, setOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const selectedBay = useMemo(
    () => bays.find((bay) => bay.parkingSpotId === parkingSpotId),
    [bays, parkingSpotId],
  );

  const requireUuid = () => {
    const normalized = deviceUuid.trim().toLowerCase();
    if (!uuidPattern.test(normalized)) throw new Error('Enter the 36-character UUID printed on the bollard.');
    return normalized;
  };

  const requireSpot = () => {
    if (!parkingSpotId) throw new Error('Choose one of your parking spots first.');
    return parkingSpotId;
  };

  const execute = async (action: Action, task: () => Promise<string>) => {
    if (busy) return;
    setBusy(action);
    setFeedback(null);
    try {
      setFeedback({ tone: 'success', message: await task() });
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'The IoT request could not be completed.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRegister = () => execute('register', async () => {
    const result = await registerIoTDevice(token, requireUuid());
    return result.message || `Bollard ${result.data.deviceUuid} is registered.`;
  });

  const handleGenerateOtp = () => execute('otp', async () => {
    const result = await generateIoTBindingOtp(token, requireUuid());
    setOtp(result.data.otp);
    setOtpExpiresAt(result.data.expiresAtUtc);
    return result.message || 'A six-digit binding code is ready.';
  });

  const handleBind = () => execute('bind', async () => {
    if (!/^\d{6}$/.test(otp)) throw new Error('Enter the six-digit code shown by the bollard.');
    const result = await bindIoTDevice(token, requireUuid(), requireSpot(), otp);
    onRefreshBays();
    return result.message || `Bollard linked to parking spot #${result.data.parkingSpotId}.`;
  });

  const handleUnlock = () => execute('unlock', async () => {
    const spotId = requireSpot();
    if (!window.confirm(`Unlock the bollard at ${selectedBay?.parkingLabel || `parking spot #${spotId}`}?`)) {
      throw new Error('Unlock cancelled.');
    }
    const result = await ownerUnlockParkingSpot(token, spotId);
    return result.message || 'The bollard confirmed that it is unlocked.';
  });

  const spotOptions = (
    <>
      <option value="">Select a parking spot</option>
      {bays.map((bay) => (
        <option key={bay.parkingSpotId} value={bay.parkingSpotId}>
          {bay.propertyName} · {bay.parkingLabel || `Spot #${bay.parkingSpotId}`}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          <Radio className="h-4 w-4" aria-hidden="true" /> Smart access
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Smart bollards</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Commission a ParkJom bollard, link it to one of your bays, and open it for on-site support.</p>
      </div>

      {baysError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{baysError}</div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141417] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><Bluetooth className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Pair a bollard</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Use the UUID on the device. The one-time code expires after five minutes and can only bind an unassigned bollard to a bay you own.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Parking spot
              <select className={fieldClass} value={parkingSpotId} onChange={(event) => setParkingSpotId(event.target.value ? Number(event.target.value) : '')} disabled={baysLoading || busy !== null}>{spotOptions}</select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Device UUID
              <input className={fieldClass} value={deviceUuid} onChange={(event) => setDeviceUuid(event.target.value)} placeholder="123e4567-e89b-12d3-a456-426614174000" autoComplete="off" spellCheck={false} disabled={busy !== null} />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void handleRegister()} disabled={busy !== null} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              {busy === 'register' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />} Register device
            </button>
            <button type="button" onClick={() => void handleGenerateOtp()} disabled={busy !== null} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              {busy === 'otp' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />} Request pairing code
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Six-digit pairing code
              <input className={fieldClass} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" disabled={busy !== null} />
            </label>
            <button type="button" onClick={() => void handleBind()} disabled={busy !== null || bays.length === 0} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {busy === 'bind' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />} Link bollard
            </button>
          </div>
          {otpExpiresAt && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Code expires {new Date(otpExpiresAt).toLocaleString()}.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141417] sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><Unlock className="h-5 w-5" aria-hidden="true" /></div>
          <h3 className="mt-4 font-bold text-slate-900 dark:text-white">Owner unlock</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Open the bollard assigned to your selected parking spot. The backend verifies that the bay belongs to your owner account.</p>
          <label className="mt-5 block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Parking spot
            <select className={fieldClass} value={parkingSpotId} onChange={(event) => setParkingSpotId(event.target.value ? Number(event.target.value) : '')} disabled={baysLoading || busy !== null}>{spotOptions}</select>
          </label>
          <button type="button" onClick={() => void handleUnlock()} disabled={busy !== null || bays.length === 0} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busy === 'unlock' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Unlock className="h-4 w-4" aria-hidden="true" />} Unlock selected bollard
          </button>
        </section>
      </div>

      {feedback && (
        <div role={feedback.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {feedback.message}
        </div>
      )}
    </div>
  );
}
