import { displayDateOptions, parseTimestamp } from '@/lib/dateTime';
import type { IoTStatusData } from '@/services/iotManagementApi';

export default function BollardStatusDetails({ status }: { status: IoTStatusData | null }) {
  if (!status) return null;
  const received = parseTimestamp(status.receivedAt);
  const reported = Number.isFinite(received.getTime()) ? received.toLocaleString('en-MY', displayDateOptions({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : null;
  return (
    <div aria-label="Reported bollard status" className="space-y-1 text-center text-xs leading-relaxed text-muted-foreground">
      <p>{status.heartbeatStatus === 'online' ? 'Device online' : status.heartbeatStatus === 'offline' ? (status.bollardPosition ? 'Device offline · showing last reported position' : 'Device offline') : 'Device connection unknown'}</p>
      <p>{reported ? 'Last reported: ' + reported : 'No device reading recorded yet.'}</p>
      {status.sensorStatus === 'unavailable' ? <p role="alert" className="font-medium text-amber-700 dark:text-amber-300">Distance sensor unavailable.</p>
        : status.distanceCm !== null ? <p>Reported distance: {status.distanceCm.toFixed(1)} cm</p> : null}
      {status.bollardPosition === null && <p>No position has been reported. Check again after the device sends a reading.</p>}
    </div>
  );
}
