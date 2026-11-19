import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronRight, Cpu, Link2, RefreshCw } from 'lucide-react';
import { listOwnerIoTDevices, type IoTDeviceInfo, type OwnerIoTDevice } from '@/services/iotManagementApi';
import OwnerBollardDialog from './OwnerBollardDialog';
import type { ParkingBay } from '../types';

interface OwnerIoTManagerProps {
  token: string;
  bays: ParkingBay[];
  baysLoading: boolean;
  baysError: string | null;
  onRefreshBays: () => void;
}

type Connection = 'online' | 'offline' | 'unknown' | 'unpaired';

const heartbeatTimeoutMs = 90_000;
const panelClass = 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#141417]';

const connectionLabels: Record<Connection, string> = {
  online: 'Online',
  offline: 'Offline',
  unknown: 'Status unknown',
  unpaired: 'Not paired',
};

function heartbeatTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`);
  return Number.isFinite(time) ? time : null;
}

function getConnection(paired: boolean | undefined, lastSeen: number | null, checkedAt: number | null, now: number): Connection {
  if (paired === false) return 'unpaired';
  if (lastSeen === null || checkedAt === null) return 'unknown';
  if (checkedAt - lastSeen >= heartbeatTimeoutMs) return 'offline';
  return now - lastSeen < heartbeatTimeoutMs ? 'online' : 'unknown';
}

function formatLastHeartbeat(lastSeen: number | null, now: number): string {
  if (lastSeen === null) return 'Not reported';
  const seconds = Math.max(0, Math.floor((now - lastSeen) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds} sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return new Date(lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Heartbeat({ connection, expanded = false }: { connection: Connection; expanded?: boolean }) {
  const online = connection === 'online';
  return (
    <div className={`px-4 pb-3 pt-4 ${online
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
      : 'bg-slate-50 text-slate-600 dark:bg-white/[0.04] dark:text-slate-400'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold"><Activity className="size-4" aria-hidden="true" />Device heartbeat</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium ${online ? 'bg-emerald-100 dark:bg-emerald-400/15' : 'bg-slate-200/70 dark:bg-white/10'}`}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{connectionLabels[connection]}
        </span>
      </div>
      <svg viewBox="0 0 280 66" preserveAspectRatio="none" className={`mt-2 block w-full ${expanded ? 'h-28 sm:h-32' : 'h-16'}`} aria-hidden="true">
        <path d="M0 12h280M0 26h280M0 40h280M0 54h280M20 0v66M60 0v66M100 0v66M140 0v66M180 0v66M220 0v66M260 0v66" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.12" vectorEffect="non-scaling-stroke" />
        {online ? (
          <path d="M0 40h36l7-4 6 4h13l8 7 9-32 9 40 8-15h18l8-4 8 4h33l7-4 6 4h12l8 6 10-32 9 40 8-14h17l8-4 8 4h24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : (
          <path d="M0 40h280" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.5" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}

export default function OwnerIoTManager({ token, bays, baysLoading, baysError, onRefreshBays }: OwnerIoTManagerProps) {
  const [dialog, setDialog] = useState<{ kind: 'pair' } | { kind: 'control'; spotId: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [pairingNotice, setPairingNotice] = useState<string | null>(null);
  const [devices, setDevices] = useState<OwnerIoTDevice[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatusLoading(true);
    setStatusError(null);
    listOwnerIoTDevices(token, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        const receivedAt = Date.now();
        setDevices(items);
        setCheckedAt(receivedAt);
        setNow(receivedAt);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDevices(null);
          setCheckedAt(null);
          setStatusError(error instanceof Error ? error.message : 'Unable to check bollard connections.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setStatusLoading(false); });
    return () => controller.abort();
  }, [token, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const devicesBySpot = new Map(devices?.filter((device) => device.isAssigned && device.parkingSpotId !== null).map((device) => [device.parkingSpotId, device]));
  const parking = bays.map((bay) => {
    const device = devicesBySpot.get(bay.parkingSpotId);
    const paired = device || bay.bollard?.isAssigned ? true : devices !== null || bay.bollard === null ? false : undefined;
    const lastSeen = heartbeatTime(device?.lastHeartbeatAt);
    return {
      bay, paired, lastSeen,
      firmware: device?.firmwareVersion?.trim(),
      connection: getConnection(paired, lastSeen, checkedAt, now),
    };
  });
  const pairedParking = parking.filter(({ paired }) => paired === true);
  const unpairedBays = parking.filter(({ paired }) => paired === false).map(({ bay }) => bay);
  const selected = dialog?.kind === 'control'
    ? pairedParking.find(({ bay }) => bay.parkingSpotId === dialog.spotId)
    : undefined;

  function openDialog(next: NonNullable<typeof dialog>, button: HTMLButtonElement) {
    setPairingNotice(null);
    trigger.current = button;
    setDialog(next);
    setDialogOpen(true);
  }

  function onPaired(device: IoTDeviceInfo) {
    setPairingNotice('Bollard paired successfully.');
    setDevices((current) => [...(current ?? []).filter((item) => item.parkingSpotId !== device.parkingSpotId), { ...device, lastHeartbeatAt: null }]);
    setRefresh((value) => value + 1);
    onRefreshBays();
  }

  const refreshButton = (
    <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={statusLoading}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-200">
      <RefreshCw className={`size-3.5 ${statusLoading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />Refresh status
    </button>
  );

  return (
    <div className="space-y-4">
      {baysError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{baysError} <button type="button" onClick={onRefreshBays} className="font-semibold underline">Retry</button></p>}
      {pairingNotice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{pairingNotice}</p>}
      {statusError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{statusError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-haspopup="dialog" disabled={baysLoading && bays.length === 0}
          onClick={(event) => openDialog({ kind: 'pair' }, event.currentTarget)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50">
          <Link2 className="size-4" aria-hidden="true" />Bind
        </button>
        {refreshButton}
      </div>
      {baysLoading && bays.length === 0 ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">Loading your parking spots…</p>
      ) : bays.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Register a parking spot before pairing a bollard.</p>
      ) : pairedParking.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {unpairedBays.length > 0 ? 'No bollards paired yet. Use Bind to connect one to a parking spot.' : 'No paired bollards to display.'}
        </p>
      ) : (
        <section aria-label="Parking spot bollards" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pairedParking.map(({ bay, connection, lastSeen, firmware }) => (
            <article key={bay.parkingSpotId} className={`${panelClass} flex min-h-[20rem] flex-col`}>
              <Heartbeat connection={connection} expanded />
              <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div>
                  <h2 className="text-base font-bold leading-tight text-slate-900 dark:text-white">{bay.propertyName}</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Bay {bay.parkingLabel || bay.bayNumber}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 border-t border-slate-100 pt-3 text-xs dark:border-white/10">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Last heartbeat</dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {lastSeen === null ? 'Not reported' : <time dateTime={new Date(lastSeen).toISOString()}>{formatLastHeartbeat(lastSeen, now)}</time>}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Cpu className="size-3" aria-hidden="true" /> Firmware</dt>
                    <dd className="mt-1 break-words font-semibold text-slate-900 dark:text-slate-100">{firmware && firmware.toLowerCase() !== 'unknown' ? firmware : 'Not reported'}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-1">
                  <button type="button" aria-haspopup="dialog"
                    onClick={(event) => openDialog({ kind: 'control', spotId: bay.parkingSpotId }, event.currentTarget)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                    Control bollard<ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      {dialog && (dialog.kind === 'pair' || selected) && (
        <OwnerBollardDialog
          key={dialog.kind === 'pair' ? 'pair' : dialog.spotId}
          mode={dialog.kind}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          trigger={trigger}
          token={token}
          bay={selected?.bay}
          unpairedBays={unpairedBays}
          deviceUuid={selected && (devicesBySpot.get(selected.bay.parkingSpotId)?.deviceUuid ?? selected.bay.bollard?.deviceUuid)}
          onPaired={onPaired}
        />
      )}
    </div>
  );
}
