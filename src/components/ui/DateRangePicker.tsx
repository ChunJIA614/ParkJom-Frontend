import { Menu } from '@base-ui/react/menu';
import { CalendarRange, Check, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  error?: string | null;
  disabled?: boolean;
}

const dateFieldClass = 'min-h-11! w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30 [color-scheme:light] dark:border-white/15 dark:bg-[#202024] dark:text-white dark:[color-scheme:dark]';

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const shortDate = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short' });
const dateWithYear = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

function getPresets(today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const monday = day - (today.getDay() + 6) % 7;
  const date = (dayOfMonth: number, monthOffset = 0) => new Date(year, month + monthOffset, dayOfMonth);

  return ([
    ['today', 'Today', today, today],
    ['thisWeek', 'This week', date(monday), date(monday + 6)],
    ['nextWeek', 'Next week', date(monday + 7), date(monday + 13)],
    ['thisMonth', 'This month', date(1), date(0, 1)],
    ['nextMonth', 'Next month', date(1, 1), date(0, 2)],
    ['next14', 'Next 14 days', today, date(day + 13)],
    ['next30', 'Next 30 days', today, date(day + 29)],
  ] as const).map(([id, label, from, to]) => {
    const formatter = from.getFullYear() === year && to.getFullYear() === year ? shortDate : dateWithYear;
    return { id, label, start: toDateString(from), end: toDateString(to), preview: formatter.formatRange(from, to) };
  });
}

export default function DateRangePicker({ startDate, endDate, onChange, error, disabled = false }: DateRangePickerProps) {
  const presets = getPresets(new Date());
  const selected = presets.find(({ start, end }) => start === startDate && end === endDate);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 min-[380px]:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          Start date
          <input type="date" className={dateFieldClass} disabled={disabled} value={startDate} onChange={(event) => onChange(event.target.value, endDate)} aria-invalid={Boolean(error)} aria-describedby={error ? 'range-date-error' : undefined} />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          End date
          <input type="date" className={dateFieldClass} disabled={disabled} value={endDate} onChange={(event) => onChange(startDate, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'range-date-error' : undefined} />
        </label>
      </div>
      {error && <p id="range-date-error" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <Menu.Root disabled={disabled}>
        <Menu.Trigger className="group flex min-h-11! w-full items-center justify-between gap-2 rounded-xl border border-border bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 dark:bg-[#202024] dark:text-slate-100 dark:hover:bg-white/10">
          <span className="inline-flex shrink-0 items-center gap-2">
            <CalendarRange className="size-4 text-primary" aria-hidden="true" />
            Quick dates
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2">
            {selected && <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">{selected.label}</span>}
            <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-aria-expanded:rotate-180 dark:text-slate-400" aria-hidden="true" />
          </span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={6} collisionPadding={12} className="z-[2500]">
            <Menu.Popup className="max-h-[min(22rem,var(--available-height))] w-[min(var(--available-width),max(17rem,var(--anchor-width)))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-white p-1.5 shadow-lg outline-none dark:bg-[#202024]">
              <Menu.RadioGroup value={selected?.id ?? ''} aria-label="Date presets">
                {presets.map(({ id, label, start, end, preview }) => (
                  <Menu.RadioItem
                    key={id}
                    value={id}
                    label={label}
                    closeOnClick
                    onClick={() => onChange(start, end)}
                    className="relative flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-xl py-2 pl-3 pr-8 text-sm outline-none data-highlighted:bg-slate-100 data-checked:text-primary dark:data-highlighted:bg-white/10"
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{preview}</span>
                    <Menu.RadioItemIndicator className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Check className="size-4" aria-hidden="true" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
