import { displayDateOptions } from '@/lib/dateTime';
import { useState, type ReactNode } from 'react';
import { showConfirm } from '@/components/common/ModalProvider';
import { ArrowLeft, CheckCircle2, ChevronRight, Copy, MapPin, Navigation } from 'lucide-react';

export interface BookingReceiptData {
  title: string;
  status: string;
  photo?: string | null;
  bay?: string;
  station?: string;
  startDate: string;
  endDate: string;
  days?: number;
  rate?: number;
  total: number;
  reference?: string;
  plate?: string;
  directions?: string;
  address?: string;
  platformFee?: number;
  cancellationReason?: string | null;
}

interface BookingReceiptCardProps {
  data: BookingReceiptData;
  heading?: 'h1' | 'h2';
  onParkingPass?: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
  cancellationUnavailableReason?: string | null;
  children?: ReactNode;
}

export function BookingReceipt({ backLabel, onBack, ...card }: BookingReceiptCardProps & {
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <button type="button" onClick={onBack} className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={17} aria-hidden="true" /> {backLabel}
      </button>
      <BookingReceiptCard {...card} />
    </main>
  );
}

export function BookingReceiptCard({ data, heading: Heading = 'h1', onParkingPass, onCancel, cancelling, cancellationUnavailableReason, children }: BookingReceiptCardProps) {
  const [copyResult, setCopyResult] = useState<{ reference: string; success: boolean }>();
  const copyFeedback = copyResult?.reference === data.reference ? copyResult : undefined;

  async function copyReference() {
    if (!data.reference) return;
    try {
      await navigator.clipboard.writeText(data.reference);
      setCopyResult({ reference: data.reference, success: true });
    } catch {
      setCopyResult({ reference: data.reference, success: false });
    }
  }

  const status = data.status.toLowerCase();
  const cancelled = status === 'cancelled' || status === 'canceled';
  const confirmed = status === 'confirmed';
  const paid = ['confirmed', 'active', 'completed'].includes(status);
  const formatMoney = (value: number) => 'RM ' + value.toFixed(2);

  return (
    <article className="workspace-panel overflow-hidden shadow-sm">
      <header className="relative isolate flex min-h-48 flex-col justify-between gap-8 overflow-hidden bg-slate-900 p-5 text-white sm:min-h-64 sm:p-7">
        {data.photo && <img key={data.photo} src={data.photo} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover"
          onError={event => { event.currentTarget.hidden = true; }} />}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />
        <p className={'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ' + (confirmed ? 'bg-emerald-700' : cancelled ? 'bg-rose-700' : 'bg-black/60')}>
          {confirmed && <CheckCircle2 size={15} aria-hidden="true" />}
          {confirmed ? 'Booking Confirmed' : data.status || 'Booking'}
        </p>
        <div>
          {data.bay && <p className="mb-1 text-sm font-semibold text-white/85">{data.bay}</p>}
          <Heading className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{data.title}</Heading>
          {data.station && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85"><MapPin size={15} aria-hidden="true" /> Near {data.station}</p>}
        </div>
      </header>

      <div className="space-y-5 p-5 sm:space-y-6 sm:p-7">
        <dl className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-muted/50">
          <div className="p-3 sm:p-4">
            <dt className="text-sm text-muted-foreground">Check-in</dt>
            <dd className="mt-1 text-base font-semibold sm:text-lg">{data.startDate}</dd>
          </div>
          <div className="p-3 sm:p-4">
            <dt className="text-sm text-muted-foreground">Check-out</dt>
            <dd className="mt-1 text-base font-semibold sm:text-lg">{data.endDate}</dd>
          </div>
        </dl>

        {data.plate && (
          <dl className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border bg-muted/50 px-4 py-3.5 sm:px-5">
            <dt className="text-sm font-medium text-muted-foreground">Number plate</dt>
            <dd className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 font-mono text-lg font-semibold tracking-wider text-white sm:text-xl">
              {data.plate}
            </dd>
          </dl>
        )}

        {(data.address || data.directions) && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {data.address && <p className="min-w-0 flex-1 basis-56 break-words text-sm text-muted-foreground">{data.address}</p>}
            {data.directions && (
              <a href={data.directions} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
                <Navigation size={15} aria-hidden="true" /> Get directions
              </a>
            )}
          </div>
        )}

        <dl className="space-y-3">
          {data.rate != null && Boolean(data.days) && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <dt>Daily rate</dt><dd>{formatMoney(data.rate)} × {data.days} {data.days === 1 ? 'day' : 'days'}</dd>
            </div>
          )}
          {data.platformFee != null && <div className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Platform fee</dt><dd>{formatMoney(data.platformFee)}</dd>
          </div>}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <dt className="text-base font-semibold">{paid ? 'Total paid' : 'Booking total'}</dt>
            <dd className="text-xl font-bold tabular-nums sm:text-2xl">{formatMoney(data.total)}</dd>
          </div>
        </dl>

        {data.reference && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-muted/50 p-3.5 sm:gap-x-4 sm:px-4">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">Booking reference</p>
              <p className="break-all select-all text-sm font-bold text-foreground">{data.reference}</p>
            </div>
            <button type="button" onClick={() => void copyReference()} aria-label="Copy booking reference"
              className="workspace-button workspace-button--secondary min-h-11 gap-2 rounded-xl bg-background px-3 sm:px-4">
              <Copy size={15} aria-hidden="true" /> {copyFeedback?.success ? 'Copied' : 'Copy'}
            </button>
            {copyFeedback && <p role="status" className={copyFeedback.success ? 'sr-only' : 'col-span-full text-xs text-muted-foreground'}>
              {copyFeedback.success ? 'Booking reference copied' : 'Copy failed. Select the reference to copy it manually.'}
            </p>}
          </div>
        )}
        {cancelled && data.cancellationReason && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{data.cancellationReason}</p>}
        {onParkingPass && <button type="button" onClick={onParkingPass} className="workspace-button workspace-button--primary min-h-12 w-full text-base">View parking pass</button>}
        {onCancel && <button type="button" onClick={onCancel} disabled={cancelling}
          className="min-h-11 w-full rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40">
          {cancelling ? 'Cancelling…' : 'Cancel booking'}
        </button>}
        {cancellationUnavailableReason && <p className="text-sm text-muted-foreground">{cancellationUnavailableReason}</p>}
        {children}
      </div>
    </article>
  );
}

export function confirmBookingCancellation() {
  return showConfirm({
    title: 'Cancel booking?',
    message: 'Cancellations at least 3 days before check-in receive a full refund. Cancellations less than 3 days before check-in receive a 50% refund.',
    confirmText: 'Cancel booking',
    cancelText: 'Keep booking',
    variant: 'danger',
    icon: 'trash',
  });
}

export function formatBookingHistoryDate(date: Date) {
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-MY', displayDateOptions({
    day: 'numeric', month: 'short', year: 'numeric',
  }));
}

export function BookingHistoryRow({ title, detail, start, end, status, total, onOpen }: {
  title: string;
  detail?: string;
  start: Date;
  end: Date;
  status: string;
  total: number;
  onOpen: () => void;
}) {
  const statusKey = status.toLowerCase();
  return (
    <button type="button" onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary sm:px-3">
      <div className="min-w-0 flex-1">
        <p className="break-words text-base font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail && <>{detail} · </>}
          {formatBookingHistoryDate(start)} – {formatBookingHistoryDate(end)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">RM {total.toFixed(2)}</p>
        <p className={'mt-1 text-sm ' + (['cancelled', 'canceled'].includes(statusKey) ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground')}>{status || 'Booking'}</p>
      </div>
      <ChevronRight size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
