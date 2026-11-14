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

const inputClass =
  'min-h-11 w-full rounded-xl border border-black/[0.1] bg-[#f5f5f7] px-3.5 text-sm text-[#1d1d1f] placeholder:text-[#8e8e93] outline-none transition focus:border-[#0071e3] focus:bg-white focus:ring-3 focus:ring-[#0071e3]/15 dark:border-white/[0.1] dark:bg-[#1c1c1f] dark:text-[#f5f5f7] dark:placeholder:text-[#8e8e93] dark:focus:border-[#0a84ff] dark:focus:bg-[#222226] dark:focus:ring-[#0a84ff]/20';

const unlockIconTone = 'bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/15 dark:text-[#0a84ff]';
const unlockButtonTone =
  'bg-[#0071e3] text-white shadow-xs hover:bg-[#0062cc] dark:bg-[#0a84ff] dark:hover:bg-[#2994ff]';
const lockIconTone = 'bg-[#ff3b30]/10 text-[#d70015] dark:bg-[#ff453a]/15 dark:text-[#ff453a]';
const lockButtonTone =
  'border border-[#ff3b30]/25 bg-[#ff3b30]/10 text-[#d70015] hover:bg-[#ff3b30]/18 dark:border-[#ff453a]/30 dark:bg-[#ff453a]/15 dark:text-[#ff6961] dark:hover:bg-[#ff453a]/25';

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3]/10 px-2.5 py-1 text-xs font-semibold text-[#0071e3] dark:bg-[#0a84ff]/15 dark:text-[#0a84ff]">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            Hardware operations
          </span>
          <h2 id="iot-title" className="mt-2.5 text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            IoT Smart Bollard Fleet
          </h2>
          <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#a1a1aa]">
            Issue authenticated overrides by booking, parking spot, or IoT device. Every successful result comes from the ESP32 acknowledgement.
          </p>
        </div>
        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1d1d1f] shadow-xs dark:border-white/[0.1] dark:bg-[#141417] dark:text-[#f5f5f7]">
          <span
            className={`h-2 w-2 rounded-full ${
              onlineBollards > 0 ? 'bg-[#34c759] dark:bg-[#30d158]' : 'bg-[#8e8e93]'
            }`}
            aria-hidden="true"
          />
          <span className="tabular-nums">{onlineBollards}/{totalBollards} bollards online</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Registered"
          value={totalBollards}
          iconTone="bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/15 dark:text-[#0a84ff]"
          icon={<HardDrive className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Online"
          value={onlineBollards}
          valueTone="text-[#1f7a34] dark:text-[#30d158]"
          iconTone="bg-[#34c759]/12 text-[#1f7a34] dark:bg-[#30d158]/15 dark:text-[#30d158]"
          icon={<Wifi className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Offline"
          value={offlineBollards}
          valueTone={offlineBollards > 0 ? 'text-[#b25000] dark:text-[#ff9f0a]' : 'text-[#1d1d1f] dark:text-[#f5f5f7]'}
          iconTone={
            offlineBollards > 0
              ? 'bg-[#ff9500]/12 text-[#b25000] dark:bg-[#ff9f0a]/15 dark:text-[#ff9f0a]'
              : 'bg-black/[0.05] text-[#6e6e73] dark:bg-white/[0.06] dark:text-[#a1a1aa]'
          }
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="flex items-start gap-3.5 rounded-2xl border border-black/[0.07] bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#141417]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff9500]/12 text-[#b25000] dark:bg-[#ff9f0a]/15 dark:text-[#ff9f0a]">
          <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Live hardware override</p>
            <span className="rounded-full bg-[#ff9500]/12 px-2 py-0.5 text-xs font-semibold text-[#b25000] dark:bg-[#ff9f0a]/15 dark:text-[#ff9f0a]">
              Caution
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-[#6e6e73] dark:text-[#a1a1aa]">
            Confirm the target ID before sending. Lock commands retain the ESP32 obstacle interlock, and timeout responses mean the final physical position is unknown.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionCard
          icon={<Lock className="h-5 w-5" aria-hidden="true" />}
          iconTone={lockIconTone}
          title="Lock by booking"
          description="Uses the device assigned to the booking."
          footer={
            <CommandButton
              tone={lockButtonTone}
              busy={busy === 'booking-lock'}
              disabled={busy !== null}
              icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              onClick={() =>
                void execute('booking-lock', `Lock booking #${bookingId}`, async () =>
                  adminLockBooking(token, requireId(bookingId, 'booking ID')),
                )
              }
            >
              Lock bollard
            </CommandButton>
          }
        >
          <IdField label="Booking ID" value={bookingId} onChange={setBookingId} placeholder="e.g. 214" disabled={busy !== null} />
        </ActionCard>

        <ActionCard
          icon={<Unlock className="h-5 w-5" aria-hidden="true" />}
          iconTone={unlockIconTone}
          title="Unlock by booking"
          description="Both documented booking routes share this control."
          footer={
            <CommandButton
              tone={unlockButtonTone}
              busy={busy === 'booking-unlock'}
              disabled={busy !== null}
              icon={<Unlock className="h-4 w-4" aria-hidden="true" />}
              onClick={() =>
                void execute('booking-unlock', `Unlock booking #${bookingId}`, async () =>
                  adminUnlockBooking(token, requireId(bookingId, 'booking ID'), unlockRoute),
                )
              }
            >
              Unlock booking bollard
            </CommandButton>
          }
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
            <IdField label="Booking ID" value={bookingId} onChange={setBookingId} placeholder="e.g. 214" disabled={busy !== null} />
            <label className="space-y-1.5 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1aa]">
              API route
              <select
                className={inputClass}
                value={unlockRoute}
                onChange={(event) => setUnlockRoute(event.target.value as 'direct' | 'booking-alias')}
                disabled={busy !== null}
              >
                <option value="direct">/admin/iot/&#123;bookingId&#125;/unlock</option>
                <option value="booking-alias">/admin/iot/bookings/&#123;bookingId&#125;/unlock</option>
              </select>
            </label>
          </div>
        </ActionCard>

        <ActionCard
          icon={<Radio className="h-5 w-5" aria-hidden="true" />}
          iconTone={unlockIconTone}
          title="Unlock by parking spot"
          description="Finds the assigned bollard without a booking."
          footer={
            <CommandButton
              tone={unlockButtonTone}
              busy={busy === 'spot-unlock'}
              disabled={busy !== null}
              icon={<Unlock className="h-4 w-4" aria-hidden="true" />}
              onClick={() =>
                void execute('spot-unlock', `Unlock parking spot #${parkingSpotId}`, async () =>
                  adminUnlockParkingSpot(token, requireId(parkingSpotId, 'parking spot ID')),
                )
              }
            >
              Unlock spot bollard
            </CommandButton>
          }
        >
          <IdField label="Parking spot ID" value={parkingSpotId} onChange={setParkingSpotId} placeholder="e.g. 31" disabled={busy !== null} />
        </ActionCard>

        <ActionCard
          icon={<HardDrive className="h-5 w-5" aria-hidden="true" />}
          iconTone={unlockIconTone}
          title="Unlock by IoT device"
          description="Targets an assigned database device ID directly."
          footer={
            <CommandButton
              tone={unlockButtonTone}
              busy={busy === 'device-unlock'}
              disabled={busy !== null}
              icon={<Unlock className="h-4 w-4" aria-hidden="true" />}
              onClick={() =>
                void execute('device-unlock', `Unlock IoT device #${iotDeviceId}`, async () =>
                  adminUnlockDevice(token, requireId(iotDeviceId, 'IoT device ID')),
                )
              }
            >
              Unlock device bollard
            </CommandButton>
          }
        >
          <IdField label="IoT device ID" value={iotDeviceId} onChange={setIoTDeviceId} placeholder="e.g. 8" disabled={busy !== null} />
        </ActionCard>
      </div>

      {feedback && (
        <div
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'error'
              ? 'border-[#ff3b30]/25 bg-[#ff3b30]/10 text-[#d70015] dark:border-[#ff453a]/30 dark:bg-[#ff453a]/15 dark:text-[#ff6961]'
              : 'border-[#34c759]/25 bg-[#34c759]/10 text-[#1f7a34] dark:border-[#30d158]/30 dark:bg-[#30d158]/15 dark:text-[#30d158]'
          }`}
        >
          {feedback.tone === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  iconTone,
  valueTone = 'text-[#1d1d1f] dark:text-[#f5f5f7]',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconTone: string;
  valueTone?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#141417]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#6e6e73] dark:text-[#a1a1aa]">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTone}`}>{icon}</span>
      </div>
      <p className={`mt-2.5 text-2xl font-bold tabular-nums ${valueTone}`}>{value}</p>
    </div>
  );
}

function ActionCard({
  icon,
  iconTone,
  title,
  description,
  children,
  footer,
}: {
  icon: React.ReactNode;
  iconTone: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="flex flex-col justify-between gap-4 rounded-2xl border border-black/[0.07] bg-white p-4 shadow-xs sm:p-5 dark:border-white/[0.08] dark:bg-[#141417]">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>{icon}</div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{title}</h3>
            <p className="mt-0.5 text-xs text-[#6e6e73] dark:text-[#a1a1aa]">{description}</p>
          </div>
        </div>
        <div>{children}</div>
      </div>
      <div>{footer}</div>
    </section>
  );
}

function IdField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1aa]">
      {label}
      <input
        type="number"
        min="1"
        inputMode="numeric"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

function CommandButton({
  tone,
  busy,
  disabled,
  icon,
  onClick,
  children,
}: {
  tone: string;
  busy: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
