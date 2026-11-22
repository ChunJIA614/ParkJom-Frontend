import BollardStatusDetails from '@/components/ui/BollardStatusDetails';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronDown, LoaderCircle, Lock, LockOpen, MapPin, RefreshCw, X } from 'lucide-react';
import {
  bindIoTDevice, ownerLockParkingSpot, ownerUnlockParkingSpot, getIoTStatus,
  type BollardPosition, type IoTDeviceInfo, type IoTStatusData,
} from '@/services/iotManagementApi';
import type { ParkingBay } from '../types';

interface OwnerBollardDialogProps {
  mode: 'pair' | 'control';
  open: boolean;
  onClose: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  token: string;
  bay?: ParkingBay;
  unpairedBays: ParkingBay[];
  deviceUuid?: string;
  onPaired: (device: IoTDeviceInfo) => void;
}

const errorClass = 'text-sm text-rose-700 dark:text-rose-300';
const spinnerClass = 'size-4 shrink-0 motion-safe:animate-spin';
const emptyCode = ['', '', '', '', '', ''];

function PairForm({ token, spotId, busy, setBusy, onPaired }: {
  token: string;
  spotId: number;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onPaired: (device: IoTDeviceInfo) => void;
}) {
  const [digits, setDigits] = useState(emptyCode);
  const [error, setError] = useState<string | null>(null);
  const fields = useRef<Array<HTMLInputElement | null>>([]);
  const otp = digits.join('');

  function focusDigit(index: number) {
    fields.current[index]?.focus();
    fields.current[index]?.select();
  }

  function enterDigits(index: number, value: string) {
    const input = value.replace(/\D/g, '').slice(0, 6);
    const start = input.length === 6 ? 0 : index;
    if (!input && value) return;
    setError(null);
    const next = [...digits];
    if (input) {
      input.split('').forEach((digit, offset) => {
        if (start + offset < 6) next[start + offset] = digit;
      });
    } else {
      next[index] = '';
    }
    setDigits(next);
    if (input) focusDigit(Math.min(start + input.length, 5));
  }

  async function pair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || otp.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await bindIoTDevice(token, spotId, otp);
      if (!data.isAssigned || data.parkingSpotId !== spotId) {
        throw new Error('The server did not confirm this pairing.');
      }
      onPaired(data);
    } catch {
      setError("Couldn't pair. Check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pair} className="space-y-5 border-t border-slate-200 pt-5 dark:border-white/10">
      <fieldset disabled={busy} aria-describedby="bollard-code-help">
        <legend className="text-sm font-semibold text-slate-900 dark:text-white">Pairing code</legend>
        <p id="bollard-code-help" className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Press the button on your bollard and enter the six-digit code it displays. The code expires in 5 minutes.
        </p>
        <div className="mt-4 grid grid-cols-6 gap-2 sm:gap-3">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => {
                fields.current[index] = node;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${index + 1} of 6`}
              aria-invalid={error ? true : undefined}
              value={digit}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => enterDigits(index, event.target.value)}
              onPaste={(event) => {
                event.preventDefault();
                enterDigits(index, event.clipboardData.getData('text'));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && !digit && index > 0) {
                  event.preventDefault();
                  focusDigit(index - 1);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  focusDigit(index + (event.key === 'ArrowLeft' ? -1 : 1));
                }
              }}
              className="h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 text-center text-xl font-medium tabular-nums text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 aria-invalid:border-rose-400 dark:border-white/20 dark:bg-white/[0.03] dark:text-white dark:focus:border-blue-400 sm:h-14"
            />
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <div className="border-t border-slate-200 pt-4 dark:border-white/10">
        <button type="submit" disabled={busy || otp.length !== 6}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 dark:disabled:bg-white/10 dark:disabled:text-slate-400">
          {busy && <LoaderCircle className={spinnerClass} aria-hidden="true" />}
          {busy ? 'Pairing…' : 'Pair bollard'}
        </button>
      </div>
    </form>
  );
}

function PairParking({ bays, spotPicker, token, busy, setBusy, onPaired }: {
  bays: ParkingBay[];
  spotPicker: RefObject<HTMLSelectElement | null>;
  token: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onPaired: (device: IoTDeviceInfo) => void;
}) {
  const [spotId, setSpotId] = useState('');
  const selectedBay = bays.find((bay) => String(bay.parkingSpotId) === spotId);

  if (bays.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">No unpaired parking spots are available.</p>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <label className="block space-y-2">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">Parking spot</span>
        <div className="relative">
          <select ref={spotPicker} value={selectedBay ? spotId : ''} onChange={(event) => setSpotId(event.target.value)} disabled={busy}
            className="min-h-13 w-full appearance-none truncate rounded-xl border border-slate-300 bg-white py-2 pl-4 pr-10 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-white/20 dark:bg-[#18181C] dark:text-white">
            <option value="" disabled>Choose a parking spot</option>
            {bays.map((bay) => (
              <option key={bay.parkingSpotId} value={bay.parkingSpotId}>
                {bay.propertyName} · Bay {bay.parkingLabel || bay.bayNumber}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-slate-600 dark:text-slate-300" aria-hidden="true" />
        </div>
      </label>
      {selectedBay && (
        <PairForm key={selectedBay.parkingSpotId} token={token} spotId={selectedBay.parkingSpotId} busy={busy} setBusy={setBusy} onPaired={onPaired} />
      )}
    </div>
  );
}

function BollardControl({ token, spotId, deviceUuid, busy, setBusy }: {
  token: string;
  spotId: number;
  deviceUuid?: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [position, setPosition] = useState<BollardPosition | null>(null);
  const [status, setStatus] = useState<IoTStatusData | null>(null);
  const [pending, setPending] = useState<BollardPosition | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [scanning, setScanning] = useState(Boolean(deviceUuid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceUuid) return;
    const controller = new AbortController();
    setScanning(true);
    setPosition(null);
    setStatus(null);
    setError(null);
    getIoTStatus(token, { deviceUuid }, controller.signal)
      .then((reported) => {
        if (!controller.signal.aborted) { setStatus(reported); setPosition(reported.bollardPosition); }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Couldn't check the position. Try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setScanning(false);
      });
    return () => controller.abort();
  }, [token, deviceUuid, refresh]);

  async function togglePosition() {
    if (!position || busy || scanning || !deviceUuid) return;
    const next = position === 'LOCKED' ? 'UNLOCKED' : 'LOCKED';
    setBusy(true);
    setPending(next);
    setError(null);
    try {
      const command = next === 'LOCKED' ? ownerLockParkingSpot : ownerUnlockParkingSpot;
      await command(token, spotId);
      setPosition(next);
    } catch {
      setError(next === 'LOCKED' ? "Couldn't lock. Try again." : "Couldn't unlock. Try again.");
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  const displayedPosition = pending ?? position;
  const locked = displayedPosition === 'LOCKED';
  const known = displayedPosition !== null && deviceUuid !== undefined;
  const label = pending ? (locked ? 'Locking…' : 'Unlocking…')
    : scanning ? 'Checking position…' : known ? (locked ? 'Locked' : 'Unlocked') : 'Position unavailable';

  return (
    <div>
      <div className="flex flex-col items-center gap-4 border-t border-slate-200 pt-6 pb-5 text-center dark:border-white/10 sm:pt-7">
        <p role="status" className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white sm:text-xl">{label}</p>
        <div className="flex w-52 flex-col items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-label="Bollard unlocked"
            aria-checked={known && !locked}
            aria-busy={busy || scanning}
            disabled={!known || busy || scanning}
            onClick={() => void togglePosition()}
            className={`relative h-[4.5rem] w-40 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 disabled:cursor-not-allowed dark:focus-visible:ring-offset-[#141417] ${known && !locked ? 'bg-linear-to-r from-blue-500 to-blue-700' : 'bg-slate-500 dark:bg-slate-600'}`}
          >
            <span className={`absolute top-2 left-2 grid size-14 place-items-center rounded-full bg-white text-slate-700 shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${known ? (locked ? '' : 'translate-x-[5.5rem]') : 'translate-x-11'}`}>
              {busy || scanning ? <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
                : known && (locked ? <Lock className="size-5" aria-hidden="true" /> : <LockOpen className="size-5 text-blue-700" aria-hidden="true" />)}
            </span>
          </button>
          <div aria-hidden="true" className="grid w-full grid-cols-2 text-sm">
            <span className={known && locked ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-400'}>Lock</span>
            <span className={known && !locked ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}>Unlock</span>
          </div>
        </div>
      </div>
      <BollardStatusDetails status={status} />
      {error && <p role="alert" className={errorClass + ' mb-4 text-center'}>{error}</p>}
      {!deviceUuid && <p className={errorClass + ' mb-4 text-center'}>Refresh device status and try again.</p>}
      {deviceUuid && (
        <div className="border-t border-slate-200 pt-4 dark:border-white/10">
          <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={busy || scanning}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:border-white/20 dark:text-slate-100 dark:hover:bg-white/10">
            <RefreshCw className={`size-4 ${scanning ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {error && !position ? 'Retry status' : 'Check position'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OwnerBollardDialog({ mode, open, onClose, trigger, token, bay, unpairedBays, deviceUuid, onPaired }: OwnerBollardDialogProps) {
  const [busy, setBusy] = useState(false);
  const spotPicker = useRef<HTMLSelectElement>(null);
  const isPairing = mode === 'pair';

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/45 motion-safe:transition-opacity motion-safe:duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          initialFocus={(interaction) => isPairing && interaction !== 'touch' ? spotPicker.current : true}
          finalFocus={trigger}
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141417] motion-safe:transition-[opacity,translate] motion-safe:duration-200 data-starting-style:translate-y-8 data-starting-style:opacity-0 data-ending-style:translate-y-8 data-ending-style:opacity-0 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-[34rem] sm:-translate-1/2 sm:rounded-3xl sm:data-starting-style:-translate-y-[48%] sm:data-ending-style:-translate-y-[48%]"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
            <Dialog.Title className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {isPairing ? 'Pair your bollard' : 'Control bollard'}
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close bollard dialog" className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">
            {isPairing ? (
              <PairParking bays={unpairedBays} spotPicker={spotPicker} token={token} busy={busy} setBusy={setBusy}
                onPaired={(device) => { onPaired(device); onClose(); }} />
            ) : bay && (
              <>
                <Dialog.Description className="mb-4 flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    <MapPin className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-base font-semibold text-slate-950 dark:text-white">{bay.propertyName}</span>
                    <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">Bay {bay.parkingLabel || bay.bayNumber}</span>
                  </span>
                </Dialog.Description>
                <BollardControl token={token} spotId={bay.parkingSpotId} deviceUuid={deviceUuid} busy={busy} setBusy={setBusy} />
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

