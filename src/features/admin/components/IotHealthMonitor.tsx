import { useState } from 'react';
import { AlertTriangle, CheckCircle2, HardDrive, Loader2, Lock, Radio, ShieldCheck, Unlock, Wifi } from 'lucide-react';
import {
  adminLockBooking,
  adminUnlockBooking,
  adminUnlockDevice,
  adminUnlockParkingSpot,
} from '@/services/iotManagementApi';

interface IotHealthMonitorProps {
  token: string;
  totalBollards: number;
  onlineBollards: number;
  addActivityLog?: (type: string, message: string, user: string) => void;
}

type Command = 'booking-lock' | 'booking-unlock' | 'spot-unlock' | 'device-unlock';
type Feedback = { tone: 'success' | 'error'; message: string } | null;

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-white/10 dark:bg-[#18181C] dark:text-white dark:focus:ring-blue-900/40';

export default function IotHealthMonitor({ token, totalBollards, onlineBollards, addActivityLog }: IotHealthMonitorProps) {
  const [bookingId, setBookingId] = useState('');
  const [parkingSpotId, setParkingSpotId] = useState('');
  const [iotDeviceId, setIoTDeviceId] = useState('');
  const [unlockRoute, setUnlockRoute] = useState<'direct' | 'booking-alias'>('direct');
  const [busy, setBusy] = useState<Command | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const offlineBollards = Math.max(0, totalBollards - onlineBollards);

  const requireId = (value: string, label: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Enter a valid ${label}.`);
    return parsed;
  };

  const execute = async (command: Command, label: string, task: () => Promise<{ message: string }>) => {
    if (busy || !window.confirm(`${label}? This sends a live command to the assigned bollard.`)) return;
    setBusy(command);
    setFeedback(null);
    try {
      const result = await task();
      const message = result.message || `${label} confirmed by the device.`;
      setFeedback({ tone: 'success', message });
      addActivityLog?.('iot', message, 'Administrator');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The IoT command could not be completed.';
      setFeedback({ tone: 'error', message });
      addActivityLog?.('iot', message, 'Administrator');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="iot-health-monitor" className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400"><Radio className="h-4 w-4" aria-hidden="true" /> Hardware operations</div>
        <h2 id="iot-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">IoT Smart Bollard Fleet</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Issue authenticated overrides by booking, parking spot, or IoT device. Every successful result comes from the ESP32 acknowledgement.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Registered" value={totalBollards} icon={<HardDrive className="h-4 w-4 text-blue-500" aria-hidden="true" />} />
        <Metric label="Online" value={onlineBollards} tone="text-emerald-600 dark:text-emerald-400" icon={<Wifi className="h-4 w-4 text-emerald-500" aria-hidden="true" />} />
        <Metric label="Offline" value={offlineBollards} tone="text-amber-600 dark:text-amber-400" icon={<AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />} />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div><p className="text-sm font-bold">Live hardware override</p><p className="mt-0.5 text-xs leading-relaxed opacity-80">Confirm the target ID before sending. Lock commands retain the ESP32 obstacle interlock, and timeout responses mean the final physical position is unknown.</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionCard icon={<Lock className="h-5 w-5" aria-hidden="true" />} iconTone="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300" title="Lock by booking" description="Uses the device assigned to the booking.">
          <IdField label="Booking ID" value={bookingId} onChange={setBookingId} placeholder="e.g. 214" disabled={busy !== null} />
          <CommandButton tone="bg-rose-600 hover:bg-rose-700" busy={busy === 'booking-lock'} disabled={busy !== null} icon={<Lock className="h-4 w-4" aria-hidden="true" />} onClick={() => void execute('booking-lock', `Lock booking #${bookingId}`, async () => adminLockBooking(token, requireId(bookingId, 'booking ID')))}>Lock bollard</CommandButton>
        </ActionCard>

        <ActionCard icon={<Unlock className="h-5 w-5" aria-hidden="true" />} iconTone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" title="Unlock by booking" description="Both documented booking routes share this control.">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.25fr]">
            <IdField label="Booking ID" value={bookingId} onChange={setBookingId} placeholder="e.g. 214" disabled={busy !== null} />
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">API route<select className={inputClass} value={unlockRoute} onChange={(event) => setUnlockRoute(event.target.value as 'direct' | 'booking-alias')} disabled={busy !== null}><option value="direct">/admin/iot/&#123;bookingId&#125;/unlock</option><option value="booking-alias">/admin/iot/bookings/&#123;bookingId&#125;/unlock</option></select></label>
          </div>
          <CommandButton tone="bg-emerald-600 hover:bg-emerald-700" busy={busy === 'booking-unlock'} disabled={busy !== null} icon={<Unlock className="h-4 w-4" aria-hidden="true" />} onClick={() => void execute('booking-unlock', `Unlock booking #${bookingId}`, async () => adminUnlockBooking(token, requireId(bookingId, 'booking ID'), unlockRoute))}>Unlock booking bollard</CommandButton>
        </ActionCard>

        <ActionCard icon={<Radio className="h-5 w-5" aria-hidden="true" />} iconTone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" title="Unlock by parking spot" description="Finds the assigned bollard without a booking.">
          <IdField label="Parking spot ID" value={parkingSpotId} onChange={setParkingSpotId} placeholder="e.g. 31" disabled={busy !== null} />
          <CommandButton tone="bg-blue-600 hover:bg-blue-700" busy={busy === 'spot-unlock'} disabled={busy !== null} icon={<Unlock className="h-4 w-4" aria-hidden="true" />} onClick={() => void execute('spot-unlock', `Unlock parking spot #${parkingSpotId}`, async () => adminUnlockParkingSpot(token, requireId(parkingSpotId, 'parking spot ID')))}>Unlock spot bollard</CommandButton>
        </ActionCard>

        <ActionCard icon={<HardDrive className="h-5 w-5" aria-hidden="true" />} iconTone="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300" title="Unlock by IoT device" description="Targets an assigned database device ID directly.">
          <IdField label="IoT device ID" value={iotDeviceId} onChange={setIoTDeviceId} placeholder="e.g. 8" disabled={busy !== null} />
          <CommandButton tone="bg-violet-600 hover:bg-violet-700" busy={busy === 'device-unlock'} disabled={busy !== null} icon={<Unlock className="h-4 w-4" aria-hidden="true" />} onClick={() => void execute('device-unlock', `Unlock IoT device #${iotDeviceId}`, async () => adminUnlockDevice(token, requireId(iotDeviceId, 'IoT device ID')))}>Unlock device bollard</CommandButton>
        </ActionCard>
      </div>

      {feedback && <div role={feedback.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {feedback.message}</div>}
    </div>
  );
}

function Metric({ label, value, icon, tone = 'text-slate-900 dark:text-white' }: { label: string; value: number; icon: React.ReactNode; tone?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181C]"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>{icon}</div><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p></div>;
}

function ActionCard({ icon, iconTone, title, description, children }: { icon: React.ReactNode; iconTone: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141417] sm:p-5"><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>{icon}</div><div><h3 className="font-bold text-slate-900 dark:text-white">{title}</h3><p className="text-xs text-slate-500 dark:text-slate-400">{description}</p></div></div><div className="mt-4 space-y-4">{children}</div></section>;
}

function IdField({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; disabled: boolean }) {
  return <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}<input type="number" min="1" inputMode="numeric" className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} /></label>;
}

function CommandButton({ tone, busy, disabled, icon, onClick, children }: { tone: string; busy: boolean; disabled: boolean; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}{children}</button>;
}
