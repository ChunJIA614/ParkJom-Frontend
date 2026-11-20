import { Ban, CalendarRange, Check, CheckCircle2, ChevronLeft, Lock } from 'lucide-react';
import DateRangePicker from '@/components/ui/DateRangePicker';
import type { OwnerAvailabilityDayPattern } from '../types';

export interface AvailabilityRangeDraft {
  start: string;
  end: string;
  fromTime: string;
  toTime: string;
  dayPattern: OwnerAvailabilityDayPattern;
  status: 'available' | 'unavailable';
}

interface AvailabilityRangeEditorProps {
  spotLabel: string;
  timeZone: string;
  draft: AvailabilityRangeDraft;
  matchingDays: number;
  dateError: string | null;
  hoursError: string | null;
  selectionError: string | null;
  saveError: string | null;
  savedMessage: string | null;
  saving: boolean;
  onChange: (changes: Partial<AvailabilityRangeDraft>) => void;
  onBack: () => void;
  onSave: () => void;
}

const fieldClass = 'min-h-11! w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30 [color-scheme:light] dark:border-white/15 dark:bg-[#202024] dark:text-white dark:[color-scheme:dark]';
const primaryActionClass = 'workspace-button workspace-button--primary min-h-11! w-full scroll-mb-24';
const dateFormat = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function AvailabilityRangeEditor({
  spotLabel, timeZone, draft, matchingDays, dateError, hoursError, selectionError, saveError,
  savedMessage, saving, onChange, onBack, onSave,
}: AvailabilityRangeEditorProps) {
  const opensDates = draft.status === 'available';
  const patternLabel = draft.dayPattern === 'Weekdays' ? 'Weekdays (Mon–Fri)' : 'Every day';
  const startLabel = dateError ? '' : dateFormat.format(new Date(draft.start));
  const endLabel = dateError ? '' : dateFormat.format(new Date(draft.end));
  const rangeLabel = draft.start === draft.end ? startLabel : `${startLabel} – ${endLabel}`;

  return (
    <div className="mx-auto max-w-[65rem] pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
        <button type="button" onClick={onBack} disabled={saving} className="inline-flex min-h-11! items-center gap-1 rounded-lg pr-2 text-sm font-semibold text-[#005fc7] hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:text-[#80baff]">
          <ChevronLeft className="size-4" aria-hidden="true" /> Back to timetable
        </button>
        <p className="min-w-0 break-words text-sm font-medium text-slate-700 dark:text-slate-300">{spotLabel}</p>
      </div>

      <form
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.65fr)] lg:gap-5"
        onSubmit={(event) => { event.preventDefault(); onSave(); }}
      >
        <fieldset disabled={saving} className="min-w-0 divide-y divide-slate-200/80 workspace-panel disabled:opacity-80 dark:divide-white/10">
          <section className="min-w-0 p-4 sm:p-6">
            <h2 id="range-availability-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Availability</h2>
            <div role="radiogroup" aria-labelledby="range-availability-heading" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.07]">
              {([
                { value: 'available', label: 'Open dates', icon: Check },
                { value: 'unavailable', label: 'Close dates', icon: Ban },
              ] as const).map(({ value, label, icon: Icon }) => (
                <label key={value} className="relative min-w-0 cursor-pointer">
                  <input type="radio" name="range-availability" value={value} checked={draft.status === value} onChange={() => onChange({ status: value })} className="peer sr-only" />
                  <span className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-1.5 text-center text-sm font-semibold text-[#50545c] hover:text-slate-900 peer-checked:bg-white peer-checked:text-[#005fc7] peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:text-white dark:peer-checked:bg-[#303036] dark:peer-checked:text-[#80baff]">
                    <Icon className="size-4 shrink-0" aria-hidden="true" /> {label}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="range-dates-heading" className="p-4 sm:p-6">
            <h2 id="range-dates-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Date range</h2>
            <DateRangePicker startDate={draft.start} endDate={draft.end} onChange={(start, end) => onChange({ start, end })} error={dateError} />
          </section>

          {opensDates && (
            <section aria-labelledby="range-hours-heading" className="space-y-3 p-4 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id="range-hours-heading" className="text-lg font-semibold text-slate-900 dark:text-white">Opening hours</h2>
                <span className="text-sm text-slate-600 dark:text-slate-400">{timeZone.replaceAll('_', ' ').split('/').at(-1)}</span>
              </div>
              <div className="grid gap-3 min-[380px]:grid-cols-2">
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Opens
                  <input type="time" className={fieldClass} value={draft.fromTime} onChange={(event) => onChange({ fromTime: event.target.value })} aria-invalid={Boolean(hoursError)} aria-describedby={hoursError ? 'range-hours-error' : undefined} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Closes
                  <input type="time" className={fieldClass} value={draft.toTime} onChange={(event) => onChange({ toTime: event.target.value })} aria-invalid={Boolean(hoursError)} aria-describedby={hoursError ? 'range-hours-error' : undefined} />
                </label>
              </div>
              {hoursError && <p id="range-hours-error" className="text-sm text-rose-700 dark:text-rose-300">{hoursError}</p>}
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                Apply on
                <select className={fieldClass} value={draft.dayPattern} onChange={(event) => onChange({ dayPattern: event.target.value as OwnerAvailabilityDayPattern })}>
                  <option value="Everyday">Every day</option>
                  <option value="Weekdays">Weekdays (Mon–Fri)</option>
                </select>
              </label>
            </section>
          )}
        </fieldset>

        <aside aria-labelledby="range-preview-heading" className="workspace-panel overflow-hidden">
          <div className="space-y-4 bg-[#e8f2ff] p-4 dark:bg-[#202b3c] sm:p-6" aria-live="polite" aria-atomic="true">
            <h2 id="range-preview-heading" className="flex items-center gap-2 text-sm font-semibold text-[#174d90] dark:text-[#9bc6ff]">
              <CalendarRange className="size-4" aria-hidden="true" /> Schedule preview
            </h2>
            {dateError ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">Choose a valid date range.</p>
            ) : (
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{matchingDays} {matchingDays === 1 ? 'date' : 'dates'} selected</p>
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">{rangeLabel}</p>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  {opensDates ? (hoursError ? patternLabel : `Open ${draft.fromTime}–${draft.toTime} · ${patternLabel}`) : 'Closed all day'}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-4 p-4 sm:p-6">
            <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Existing bookings stay locked.</p>
            {selectionError && <p role="status" className="text-sm font-medium text-rose-700 dark:text-rose-300">{selectionError}</p>}
            {saveError && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{saveError}</p>}
            {savedMessage && <p role="status" className="flex items-start gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {savedMessage}</p>}
            {savedMessage ? (
              <button type="button" onClick={onBack} className={primaryActionClass}>View timetable</button>
            ) : (
              <button type="submit" disabled={Boolean(saving || dateError || hoursError || selectionError)} className={primaryActionClass}>
                {saving ? 'Saving availability…' : opensDates ? 'Save opening hours' : 'Close dates'}
              </button>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
