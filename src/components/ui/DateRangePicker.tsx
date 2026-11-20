interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  error?: string | null;
}

const dateFieldClass = 'min-h-11! w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30 [color-scheme:light] dark:border-white/15 dark:bg-[#202024] dark:text-white dark:[color-scheme:dark]';

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function presetRange(preset: string): [string, string] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const monday = day - (today.getDay() + 6) % 7;
  let start = today;
  let end = today;

  switch (preset) {
    case 'thisWeek':
      start = new Date(year, month, monday);
      end = new Date(year, month, monday + 6);
      break;
    case 'nextWeek':
      start = new Date(year, month, monday + 7);
      end = new Date(year, month, monday + 13);
      break;
    case 'thisMonth':
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0);
      break;
    case 'nextMonth':
      start = new Date(year, month + 1, 1);
      end = new Date(year, month + 2, 0);
      break;
    case 'next14':
      end = new Date(year, month, day + 13);
      break;
    case 'next30':
      end = new Date(year, month, day + 29);
      break;
  }

  return [toDateString(start), toDateString(end)];
}

export default function DateRangePicker({ startDate, endDate, onChange, error }: DateRangePickerProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 min-[380px]:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          Start date
          <input type="date" className={dateFieldClass} value={startDate} onChange={(event) => onChange(event.target.value, endDate)} aria-invalid={Boolean(error)} aria-describedby={error ? 'range-date-error' : undefined} />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          End date
          <input type="date" className={dateFieldClass} value={endDate} onChange={(event) => onChange(startDate, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'range-date-error' : undefined} />
        </label>
      </div>
      {error && <p id="range-date-error" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <select
        aria-label="Quick dates"
        className="min-h-11! w-fit max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 dark:border-white/15 dark:bg-[#202024] dark:text-slate-200 dark:[color-scheme:dark]"
        value=""
        onChange={(event) => onChange(...presetRange(event.target.value))}
      >
        <option value="" disabled>Quick dates…</option>
        <option value="today">Today</option>
        <option value="thisWeek">This week</option>
        <option value="nextWeek">Next week</option>
        <option value="thisMonth">This month</option>
        <option value="nextMonth">Next month</option>
        <option value="next14">Next 14 days</option>
        <option value="next30">Next 30 days</option>
      </select>
    </div>
  );
}
