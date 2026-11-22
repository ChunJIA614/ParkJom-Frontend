import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Copy, Loader2, Lock, Radio, RefreshCw, Search, Unlock } from 'lucide-react';
import { showConfirm } from '@/components/common/ModalProvider';
import { displayDateOptions, parseTimestamp, type Timestamp } from '@/lib/dateTime';
import { adminLockDevice, adminUnlockDevice, getIoTStatus, IoTCommandError, scanIoTStatus, type IoTStatusData } from '@/services/iotManagementApi';
import { bollardSearchModes, searchSupportBollards, validateBollardSearch, type BollardSearch, type BollardSearchMode, type BollardSearchPage, type SupportBollard } from '../api/bollardSupportApi';
import AdminPageHeader from './AdminPageHeader';

type Command = 'lock' | 'unlock';
type Notice = { tone: 'error' | 'success'; text: string };
type LogActivity = (type: string, message: string, user: string) => void;

const fieldClass = 'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60';
const utcClock = new Intl.DateTimeFormat('en-MY', displayDateOptions({
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}));
const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

function utcDate(value: Timestamp) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) {
    return parseTimestamp(value + 'Z');
  }
  return parseTimestamp(value);
}

function reportedTime(value: Timestamp, now: number) {
  const date = utcDate(value);
  if (!Number.isFinite(date.getTime())) return 'Not reported';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  const age = seconds < 60 ? relativeTime.format(-seconds, 'second')
    : seconds < 3600 ? relativeTime.format(-Math.floor(seconds / 60), 'minute')
    : seconds < 86400 ? relativeTime.format(-Math.floor(seconds / 3600), 'hour')
    : relativeTime.format(-Math.floor(seconds / 86400), 'day');
  return utcClock.format(date) + ' · ' + age;
}

function bayName(device: SupportBollard) {
  const spot = device.parkingSpot;
  return spot ? (spot.parkingLabel ? 'Bay ' + spot.parkingLabel : 'Spot #' + spot.parkingSpotId) : 'Unassigned bollard';
}

function activeSession(device: SupportBollard) {
  return device.booking?.bookingStatus === 'Active' && device.booking.actualExitAt == null;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{children}</dd></div>;
}

function BollardInspector({ token, device, now, needsScan, onNeedsScan, onCommandBusy, addActivityLog }: {
  token: string;
  device: SupportBollard;
  now: number;
  needsScan: boolean;
  onNeedsScan: (uuid: string, value: boolean) => void;
  onCommandBusy: (value: boolean) => void;
  addActivityLog?: LogActivity;
}) {
  const [status, setStatus] = useState<IoTStatusData | null>(null);
  const [reading, setReading] = useState<'stored' | 'scan' | null>('stored');
  const [readError, setReadError] = useState<string | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const uuid = device.deviceUuid;

  async function readStatus(mode: 'stored' | 'scan') {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setReading(mode);
    setReadError(null);
    try {
      const result = mode === 'scan' ? await scanIoTStatus(token, uuid, controller.signal)
        : await getIoTStatus(token, { deviceUuid: uuid }, controller.signal);
      if (controller.signal.aborted) return;
      if (result.deviceUuid.toLowerCase() !== uuid.toLowerCase()) throw new Error('The reading belongs to a different device.');
      setStatus(result);
      if (mode === 'scan' && result.bollardPosition) {
        onNeedsScan(uuid, false);
      }
    } catch (error) {
      if (!controller.signal.aborted) setReadError(errorText(error, 'Unable to load device status.'));
    } finally {
      if (!controller.signal.aborted) setReading(null);
    }
  }

  useEffect(() => {
    if (uuid) void readStatus('stored');
    else setReading(null);
    return () => request.current?.abort();
  }, [token, uuid]);

  async function runCommand(action: Command) {
    if (!device.canControl || !uuid || needsScan || reading || sending.current) return;
    sending.current = true;
    onCommandBusy(true);
    const label = action === 'lock' ? 'Lock' : 'Unlock';
    try {
      const confirmed = await showConfirm({
        title: label + ' this bollard?',
        message: bayName(device) + ' · ' + (device.parkingSpot?.property.propertyName || 'Device #' + device.ioTDeviceId)
          + '\nDevice ' + uuid + '\nConfirm the device with the customer. Make sure the bay is clear before moving the bollard.',
        confirmText: label + ' bollard',
        cancelText: 'Cancel',
        variant: action === 'lock' ? 'danger' : 'info',
      });
      if (!confirmed) return;
      setCommand(action);
      setNotice(null);
      const send = action === 'lock' ? adminLockDevice : adminUnlockDevice;
      const result = await send(token, uuid);
      setNotice({ tone: 'success', text: result.message || (label + ' confirmed by the device.') });
      addActivityLog?.('IoT', label + ' confirmed for ' + bayName(device) + ' (' + uuid + ')', 'Admin');
      await readStatus('stored');
    } catch (error) {
      const uncertain = !(error instanceof IoTCommandError) || error.needsPositionCheck;
      if (uncertain) onNeedsScan(uuid, true);
      setNotice({ tone: 'error', text: errorText(error, 'The command result could not be confirmed.') });
    } finally {
      setCommand(null);
      sending.current = false;
      onCommandBusy(false);
    }
  }

  const spot = device.parkingSpot;
  const booking = device.booking;
  const position = status?.bollardPosition === 'LOCKED' ? 'Locked' : status?.bollardPosition === 'UNLOCKED' ? 'Unlocked' : 'Unknown';
  const movementDisabled = !device.canControl || !uuid || !!reading || !!command || needsScan;

  return (
    <div className="divide-y divide-border">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Device #{device.ioTDeviceId}</p>
            <h2 id="selected-bollard-title" className="mt-1 break-words text-xl font-semibold">{bayName(device)}</h2>
            {spot && <p className="mt-1 text-sm text-muted-foreground">{spot.property.propertyName}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{device.isAssigned ? 'Assigned' : 'Unassigned'}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1 rounded-xl bg-muted p-2.5">
          <code className="min-w-0 flex-1 break-all text-xs">{uuid || 'UUID unavailable'}</code>
          {uuid && <button type="button" aria-label={copied ? 'Device UUID copied' : 'Copy device UUID'} title={copied ? 'Copied' : 'Copy device UUID'}
            className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-card focus-visible:outline-2"
            onClick={async () => {
              try { await navigator.clipboard.writeText(uuid); setCopied(true); }
              catch { setCopied(false); }
            }}><Copy size={15} aria-hidden="true" /></button>}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Owner">{spot ? spot.owner.name || 'User #' + spot.owner.userId : 'No linked parking spot'}</Detail>
          <Detail label="Firmware">{device.firmwareVersion || 'Unknown'}</Detail>
          {spot && <Detail label="Address">{spot.property.address || 'Unavailable'}</Detail>}
          {spot && <Detail label="Parking spot">#{spot.parkingSpotId} · {spot.availabilityStatus}</Detail>}
        </dl>
      </div>

      <section className="space-y-3 p-4 sm:p-5" aria-labelledby="bollard-reading-title" aria-busy={!!reading}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="bollard-reading-title" className="text-sm font-semibold">Device status</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="workspace-button workspace-button--secondary" disabled={!uuid || !!reading || !!command} onClick={() => void readStatus('stored')}>
              <RefreshCw size={15} aria-hidden="true" /> {reading === 'stored' ? 'Reading…' : 'Refresh status'}
            </button>
            <button type="button" className="workspace-button workspace-button--secondary" disabled={!uuid || !!reading || !!command} onClick={() => void readStatus('scan')}>
              <Radio size={15} aria-hidden="true" /> {reading === 'scan' ? 'Scanning…' : 'Scan device'}
            </button>
          </div>
        </div>
        {reading && <p role="status" className="text-xs text-muted-foreground">{reading === 'scan' ? 'Waiting for a fresh reading from the bollard…' : 'Loading the latest stored reading…'}</p>}
        {readError && <p role="alert" className="rounded-lg bg-rose-500/10 p-2.5 text-sm text-rose-700 dark:text-rose-300">{readError}{status && ' Showing the previous reading.'}</p>}
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-3">
          <Detail label="Reported position">{position}</Detail>
          <Detail label="Heartbeat">{status?.heartbeatStatus === 'online' ? 'Online' : status?.heartbeatStatus === 'offline' ? 'Offline' : 'Unknown'}</Detail>
          <Detail label="Distance">{status?.distanceCm != null ? status.distanceCm.toFixed(1) + ' cm' : 'Not reported'}</Detail>
          <Detail label="Distance sensor">{status?.sensorStatus === 'ok' ? 'OK' : status?.sensorStatus === 'unavailable' ? <span className="text-amber-700 dark:text-amber-300">Unavailable</span> : 'Unknown'}</Detail>
          <Detail label="Reading time">{reportedTime(status?.receivedAt, now)}</Detail>
          <Detail label="Last device contact">{reportedTime(status?.lastHeartbeatAt, now)}</Detail>
        </dl>
        {status && !status.receivedAt && <p className="text-xs text-muted-foreground">No device reading has been recorded.</p>}
      </section>

      <section className="space-y-3 p-4 sm:p-5" aria-labelledby="bollard-control-title">
        <h3 id="bollard-control-title" className="text-sm font-semibold">Move bollard</h3>
        {!device.canControl && <p className="text-sm text-muted-foreground">Movement is unavailable for this device. You can still inspect its status.</p>}
        {needsScan && <p role="status" className="rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-800 dark:text-amber-300">The command outcome is uncertain. Scan the device to verify its position before sending another command.</p>}
        {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={notice.tone === 'error' ? 'text-sm text-rose-700 dark:text-rose-300' : 'text-sm text-emerald-700 dark:text-emerald-300'}>{notice.text}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="workspace-button workspace-button--secondary" disabled={movementDisabled} onClick={() => void runCommand('lock')}>
            {command === 'lock' ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
            {command === 'lock' ? 'Locking…' : 'Lock'}
          </button>
          <button type="button" className="workspace-button workspace-button--primary" disabled={movementDisabled} onClick={() => void runCommand('unlock')}>
            {command === 'unlock' ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <Unlock size={16} aria-hidden="true" />}
            {command === 'unlock' ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </section>

      <section className="space-y-3 p-4 sm:p-5" aria-labelledby="bollard-booking-title">
        <h3 id="bollard-booking-title" className="text-sm font-semibold">{activeSession(device) ? 'Active renter session' : 'Booking context'}</h3>
        {booking ? <dl className="grid grid-cols-2 gap-3">
          <Detail label="Booking">{booking.bookingReference || '#' + booking.bookingId}</Detail>
          <Detail label="Status">{booking.bookingStatus}</Detail>
          <Detail label="Renter">{booking.renter.name || 'User #' + booking.renter.userId}</Detail>
          <Detail label="Start date (Malaysia)">{booking.startDate.slice(0, 10)}</Detail>
          <Detail label="End date (exclusive)">{booking.endDate.slice(0, 10)}</Detail>
          <Detail label="Check-in">{reportedTime(booking.checkedInAt, now)}</Detail>
          <Detail label="Exit">{reportedTime(booking.actualExitAt, now)}</Detail>
        </dl> : <p className="text-sm text-muted-foreground">No booking context</p>}
      </section>
    </div>
  );
}

export default function IotHealthMonitor({ token, addActivityLog }: { token: string; addActivityLog?: LogActivity }) {
  const [by, setBy] = useState<BollardSearchMode>('bookingReference');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [submitted, setSubmitted] = useState<BollardSearch | null>(null);
  const [results, setResults] = useState<{ search: BollardSearch; data: BollardSearchPage } | null>(null);
  const [selected, setSelected] = useState<SupportBollard | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now);
  const searchRequest = useRef<AbortController | null>(null);
  const detailPanel = useRef<HTMLElement | null>(null);
  const mode = bollardSearchModes.find(option => option.value === by)!;

  useEffect(() => () => searchRequest.current?.abort(), [token]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (selected && window.matchMedia('(max-width: 1279px)').matches) {
      detailPanel.current?.focus({ preventScroll: true });
      detailPanel.current?.scrollIntoView({ block: 'start' });
    }
  }, [selected]);

  async function runSearch(search: BollardSearch) {
    if (commandBusy) return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSubmitted(search);
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const data = await searchSupportBollards(token, search, controller.signal);
      if (!controller.signal.aborted) setResults({ search, data });
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(errorText(error, 'Could not search for bollards. Try again.'));
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateBollardSearch(by, query);
    setFieldError(error);
    if (!error) void runSearch({ by, q: query.trim(), page: 1, pageSize });
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Smart bollards" description="Find a customer's bollard, check its status, and help them lock or unlock it." />
      <form onSubmit={submit} className="workspace-panel p-4 sm:p-5" aria-label="Search bollards">
        <fieldset disabled={commandBusy} className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(0,1.8fr)] lg:grid-cols-[minmax(10rem,1fr)_minmax(0,1.8fr)_7rem_auto] lg:items-end">
          <label className="grid gap-1.5 text-sm font-medium">Search by
            <select value={by} onChange={event => { setBy(event.target.value as BollardSearchMode); setFieldError(null); }} className={fieldClass}>
              {bollardSearchModes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{mode.label}
            <input value={query} onChange={event => { setQuery(event.target.value); setFieldError(null); }}
              placeholder={mode.placeholder} maxLength={120} inputMode={mode.kind === 'id' ? 'numeric' : 'text'} className={fieldClass}
              aria-invalid={!!fieldError} aria-describedby={fieldError ? 'bollard-search-validation' : undefined} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Per page
            <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className={fieldClass}>
              {[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="submit" className="workspace-button workspace-button--primary min-h-11 self-end"><Search size={16} aria-hidden="true" /> Search</button>
        </fieldset>
        {fieldError && <p id="bollard-search-validation" role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{fieldError}</p>}
      </form>

      {searchError && <div className="workspace-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{searchError}</p>
        {submitted && <button type="button" disabled={searching || commandBusy} className="workspace-button workspace-button--secondary" onClick={() => void runSearch(submitted)}>Retry search</button>}
      </div>}

      {results || searching ? <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-label="Matching bollards" aria-busy={searching} className="workspace-panel min-w-0 overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">Matching bollards</h2>
            {searching ? <p role="status" className="mt-1 text-sm text-muted-foreground">Searching…</p>
              : results && <p className="mt-1 break-words text-sm text-muted-foreground">{bollardSearchModes.find(option => option.value === results.search.by)?.label} · {results.search.q}{searchError ? ' · Previous results' : ''}</p>}
          </div>
          {results?.data.items.length === 0 && !searching && <p className="p-4 text-sm text-muted-foreground">No matching bollards found.</p>}
          <ul className="divide-y divide-border">
            {results?.data.items.map(device => {
              const current = selected?.ioTDeviceId === device.ioTDeviceId;
              return <li key={device.ioTDeviceId}>
                <button type="button" aria-pressed={current} disabled={commandBusy || searching} onClick={() => setSelected(device)}
                  className={'flex w-full items-start gap-3 p-4 text-left hover:bg-muted/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60 ' + (current ? 'bg-blue-500/10' : '')}>
                  <Radio size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block break-words text-sm font-semibold">{bayName(device)}{device.parkingSpot && ' · ' + device.parkingSpot.property.propertyName}</span>
                    <span className="block break-words text-xs text-muted-foreground">{device.parkingSpot ? 'Owner ' + (device.parkingSpot.owner.name || '#' + device.parkingSpot.owner.userId) : 'No linked parking spot'}</span>
                    {device.booking && <span className="block break-words text-xs text-muted-foreground">{device.booking.renter.name || 'Renter #' + device.booking.renter.userId} · {device.booking.bookingReference || '#' + device.booking.bookingId} · {activeSession(device) ? 'Active session' : device.booking.bookingStatus}</span>}
                    <span className="block break-all text-xs text-muted-foreground">#{device.ioTDeviceId}{device.deviceUuid && ' · ' + device.deviceUuid.slice(-8)} · Last contact {reportedTime(device.lastHeartbeatAt, now)}</span>
                  </span>
                  <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>;
            })}
          </ul>
          {results && <nav aria-label="Search result pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
            <button type="button" className="workspace-button workspace-button--secondary" disabled={searching || commandBusy || results.data.page <= 1} onClick={() => void runSearch({ ...results.search, page: results.data.page - 1 })}><ArrowLeft size={14} aria-hidden="true" /> Previous</button>
            <span className="text-sm text-muted-foreground">Page {results.data.page}</span>
            <button type="button" className="workspace-button workspace-button--secondary" disabled={searching || commandBusy || !results.data.hasMore || results.data.page >= 10000} onClick={() => void runSearch({ ...results.search, page: results.data.page + 1 })}>Next <ArrowRight size={14} aria-hidden="true" /></button>
          </nav>}
        </section>
        {selected ? <section ref={detailPanel} tabIndex={-1} aria-labelledby="selected-bollard-title" className="workspace-panel min-w-0 scroll-mt-24">
          <BollardInspector key={selected.ioTDeviceId} token={token} device={selected} now={now}
            needsScan={uncertain[selected.deviceUuid] === true} onNeedsScan={(uuid, value) => setUncertain(previous => ({ ...previous, [uuid]: value }))}
            onCommandBusy={setCommandBusy} addActivityLog={addActivityLog} />
        </section> : results && results.data.items.length > 0 && <div className="workspace-panel hidden p-5 text-sm text-muted-foreground xl:block">Select a bollard to see its status and controls.</div>}
      </div> : !searchError && <p className="px-1 text-sm text-muted-foreground">Start with a booking reference, customer name, or device ID.</p>}
    </div>
  );
}
