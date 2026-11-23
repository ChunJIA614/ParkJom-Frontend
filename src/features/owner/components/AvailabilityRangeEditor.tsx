import { Ban, Check } from 'lucide-react';
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
  rangeMode: boolean;
  timeZone: string;
  draft: AvailabilityRangeDraft;
  dayIsOpen: boolean;
  dateError: string | null;
  hoursError: string | null;
  selectionError: string | null;
  saveError: string | null;
  savedMessage: string | null;
  saving: boolean;
  loading: boolean;
  calendarUnavailable: boolean;
  onChange: (changes: Partial<AvailabilityRangeDraft>) => void;
  onSave: () => void;
}

const fieldClass = 'min-h-11! w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 text-base text-slate-900 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30 [color-scheme:light] dark:border-white/15 dark:bg-[#202024] dark:text-white dark:[color-scheme:dark]';
const labelClass = 'grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300';

export default function AvailabilityRangeEditor({
  rangeMode, timeZone, draft, dayIsOpen, dateError, hoursError, selectionError, saveError,
  savedMessage, saving, loading, calendarUnavailable, onChange, onSave,
}: AvailabilityRangeEditorProps) {
  const opensDates = draft.status === 'available';

  return (
    <form className="@container space-y-4 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <fieldset disabled={saving || loading || calendarUnavailable} className="min-w-0 space-y-4 disabled:opacity-70">
        {rangeMode && (
          <DateRangePicker startDate={draft.start} endDate={draft.end} onChange={(start, end) => onChange({ start, end })} error={dateError} disabled={saving || loading || calendarUnavailable} />
        )}

        {!rangeMode && !loading && !calendarUnavailable && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{dayIsOpen ? 'Currently open' : 'Currently closed'}</p>
        )}

        <div role="radiogroup" aria-label="Set availability" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.07]">
          {([
            { value: 'available', label: rangeMode ? 'Open dates' : 'Set open', icon: Check },
            { value: 'unavailable', label: rangeMode ? 'Close dates' : 'Set closed', icon: Ban },
          ] as const).map(({ value, label, icon: Icon }) => (
            <label key={value} className="relative min-w-0 cursor-pointer">
              <input type="radio" name="schedule-availability" value={value} checked={draft.status === value} onChange={() => onChange({ status: value })} className="peer sr-only" />
              <span className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 text-center text-sm font-semibold text-slate-600 peer-checked:bg-white peer-checked:text-[#005fc7] peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600 dark:text-slate-300 dark:peer-checked:bg-[#303036] dark:peer-checked:text-[#80baff]">
                <Icon className="size-4 shrink-0" aria-hidden="true" /> {label}
              </span>
            </label>
          ))}
        </div>

        {opensDates && (
          <section aria-labelledby="owner-opening-hours" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 id="owner-opening-hours" className="text-base font-semibold text-slate-900 dark:text-white">Opening hours</h4>
              <span className="text-sm text-slate-600 dark:text-slate-400">{timeZone.replaceAll('_', ' ').split('/').at(-1)}</span>
            </div>
            <div className="grid gap-2 @min-[275px]:grid-cols-2">
              <label className={labelClass}>
                Opens
                <input type="time" className={fieldClass} value={draft.fromTime} onChange={(event) => onChange({ fromTime: event.target.value })} aria-invalid={Boolean(hoursError)} aria-describedby={hoursError ? 'owner-hours-error' : undefined} />
              </label>
              <label className={labelClass}>
                Closes
                <input type="time" className={fieldClass} value={draft.toTime} onChange={(event) => onChange({ toTime: event.target.value })} aria-invalid={Boolean(hoursError)} aria-describedby={hoursError ? 'owner-hours-error' : undefined} />
              </label>
            </div>
            {hoursError && <p id="owner-hours-error" className="text-sm text-rose-700 dark:text-rose-300">{hoursError}</p>}
            {rangeMode && (
              <label className={labelClass}>
                Apply on
                <select className={fieldClass} value={draft.dayPattern} onChange={(event) => onChange({ dayPattern: event.target.value as OwnerAvailabilityDayPattern })}>
                  <option value="Everyday">Every day</option>
                  <option value="Weekdays">Weekdays (Mon–Fri)</option>
                </select>
              </label>
            )}
          </section>
        )}
      </fieldset>

      {calendarUnavailable && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">Refresh the calendar to edit this date.</p>}
      {selectionError && <p role="status" className="text-sm text-rose-700 dark:text-rose-300">{selectionError}</p>}
      {saveError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{saveError}</p>}
      {savedMessage && <p role="status" className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{savedMessage}</p>}
      <button
        type="submit"
        disabled={Boolean(saving || loading || calendarUnavailable || dateError || hoursError || selectionError || savedMessage || (!rangeMode && !opensDates && !dayIsOpen))}
        className="workspace-button workspace-button--primary min-h-11! w-full"
      >
        {saving ? 'Saving…' : opensDates ? 'Save opening hours' : rangeMode ? 'Close dates' : 'Close date'}
      </button>
    </form>
  );
}
