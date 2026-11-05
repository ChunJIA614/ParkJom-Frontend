import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CalendarRange,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';

export interface DateRangePickerProps {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  onChange: (startDate: string, endDate: string) => void;
  disabled?: boolean;
  minDate?: string; // Optional 'YYYY-MM-DD' lower bound
  maxDate?: string; // Optional 'YYYY-MM-DD' upper bound
  className?: string;
}

function pad(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatPrettyDate(str: string): string {
  if (!str) return '—';
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getDaysCount(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const s = parseDate(startStr).getTime();
  const e = parseDate(endStr).getTime();
  if (e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  disabled = false,
  minDate,
  maxDate,
  className = '',
}: DateRangePickerProps) {
  // Navigation month cursor
  const initialCursor = useMemo(() => {
    return startDate ? parseDate(startDate) : new Date();
  }, [startDate]);

  const [cursor, setCursor] = useState<Date>(
    new Date(initialCursor.getFullYear(), initialCursor.getMonth(), 1)
  );

  // When picking: hoverDate shows prospective range preview
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isPickingEnd, setIsPickingEnd] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Sync cursor when startDate changes externally if cursor is wildly different
  useEffect(() => {
    if (startDate) {
      const parsed = parseDate(startDate);
      if (
        parsed.getFullYear() !== cursor.getFullYear() ||
        parsed.getMonth() !== cursor.getMonth()
      ) {
        setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
    }
  }, [startDate]);

  const cursorYear = cursor.getFullYear();
  const cursorMonth = cursor.getMonth();

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat('en-MY', {
      month: 'long',
      year: 'numeric',
    }).format(cursor);
  }, [cursor]);

  const changeMonth = (offset: number) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const jumpToToday = () => {
    const today = new Date();
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Calendar days calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(cursorYear, cursorMonth, 1).getDay();
    const daysInCurrentMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(cursorYear, cursorMonth, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevDate = new Date(cursorYear, cursorMonth - 1, day);
      cells.push({
        dateStr: toDateString(prevDate),
        dayNum: day,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const d = new Date(cursorYear, cursorMonth, day);
      cells.push({
        dateStr: toDateString(d),
        dayNum: day,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill complete weeks (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(cursorYear, cursorMonth + 1, day);
      cells.push({
        dateStr: toDateString(nextDate),
        dayNum: day,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [cursorYear, cursorMonth]);

  // Handle day click
  const handleDayClick = (dateStr: string) => {
    if (disabled) return;
    if (minDate && dateStr < minDate) return;
    if (maxDate && dateStr > maxDate) return;

    if (!isPickingEnd || !startDate) {
      // First click: sets start date, starts range selection
      onChange(dateStr, dateStr);
      setIsPickingEnd(true);
      setHoverDate(dateStr);
    } else {
      // Second click: completes range
      if (dateStr < startDate) {
        // Clicked date is earlier than start: swap them
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
      setIsPickingEnd(false);
      setHoverDate(null);
    }
  };

  // Quick preset helper
  const applyPreset = (preset: 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth' | 'next14' | 'next30') => {
    if (disabled) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let start = new Date(now);
    let end = new Date(now);

    switch (preset) {
      case 'today':
        break;
      case 'tomorrow':
        start.setDate(start.getDate() + 1);
        end.setDate(end.getDate() + 1);
        break;
      case 'thisWeek': {
        const day = now.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        start.setDate(now.getDate() + diffToMon);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'nextWeek': {
        const day = now.getDay();
        const diffToNextMon = (day === 0 ? 1 : 8 - day);
        start.setDate(now.getDate() + diffToNextMon);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'thisMonth': {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      }
      case 'nextMonth': {
        start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        break;
      }
      case 'next14': {
        end.setDate(now.getDate() + 13);
        break;
      }
      case 'next30': {
        end.setDate(now.getDate() + 29);
        break;
      }
    }

    const startStr = toDateString(start);
    const endStr = toDateString(end);
    onChange(startStr, endStr);
    setCursor(new Date(start.getFullYear(), start.getMonth(), 1));
    setIsPickingEnd(false);
    setHoverDate(null);
  };

  const daysCount = useMemo(() => getDaysCount(startDate, endDate), [startDate, endDate]);

  // Determine active start/end for display and prospective range
  const activeStart = startDate;
  const activeEnd = isPickingEnd && hoverDate ? (hoverDate >= startDate ? hoverDate : startDate) : endDate;
  const activeEffectiveStart = isPickingEnd && hoverDate && hoverDate < startDate ? hoverDate : activeStart;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ── Summary & Trigger Strip ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* From Input / Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 py-2 shadow-xs transition-colors">
            <CalendarIcon className="h-4 w-4 text-[#007AFF] shrink-0" aria-hidden="true" />
            <div className="text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">
                From
              </span>
              <span className="block text-xs font-bold text-slate-800 dark:text-white">
                {formatPrettyDate(startDate)}
              </span>
            </div>
          </div>

          <ArrowRight className="h-4 w-4 text-slate-300 dark:text-white/20 shrink-0 hidden sm:block" aria-hidden="true" />

          {/* To Input / Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 py-2 shadow-xs transition-colors">
            <CalendarRange className="h-4 w-4 text-[#007AFF] shrink-0" aria-hidden="true" />
            <div className="text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">
                To
              </span>
              <span className="block text-xs font-bold text-slate-800 dark:text-white">
                {formatPrettyDate(endDate)}
              </span>
            </div>
          </div>

          {/* Duration Badge */}
          {daysCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 px-2.5 py-1 text-[11px] font-bold text-[#007AFF] dark:text-[#3894FF]">
              {daysCount} {daysCount === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>

        {/* Quick action controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-[#007AFF]" />
            {isExpanded ? 'Hide calendar' : 'Show calendar'}
          </button>
        </div>
      </div>

      {/* ── Quick Presets Carousel / Pills ── */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5" aria-label="Date presets">
        <button
          type="button"
          onClick={() => applyPreset('today')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset('thisWeek')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          This week
        </button>
        <button
          type="button"
          onClick={() => applyPreset('nextWeek')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          Next week
        </button>
        <button
          type="button"
          onClick={() => applyPreset('thisMonth')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          This month
        </button>
        <button
          type="button"
          onClick={() => applyPreset('nextMonth')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          Next month
        </button>
        <button
          type="button"
          onClick={() => applyPreset('next14')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          14 days
        </button>
        <button
          type="button"
          onClick={() => applyPreset('next30')}
          disabled={disabled}
          className="min-h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#007AFF]/50 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          30 days
        </button>
      </div>

      {/* ── Interactive Visual Calendar ── */}
      {isExpanded && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-3.5 shadow-sm transition-all">
          {/* Month Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#202024] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={jumpToToday}
                disabled={disabled}
                className="rounded-md border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-[#007AFF] dark:text-[#3894FF] hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
              >
                Today
              </button>
            </div>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#202024] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Weekday Names */}
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((wd) => (
              <span
                key={wd}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71717A] py-1"
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div
            className="mt-1 grid grid-cols-7 gap-y-1 gap-x-0"
            onMouseLeave={() => {
              if (isPickingEnd) setHoverDate(null);
            }}
          >
            {calendarGrid.map((cell) => {
              const { dateStr, dayNum, isCurrentMonth } = cell;

              const isStart = dateStr === activeEffectiveStart;
              const isEnd = dateStr === activeEnd;
              const isSingleDay = activeEffectiveStart === activeEnd && isStart;
              const isInRange =
                Boolean(activeEffectiveStart && activeEnd) &&
                dateStr > activeEffectiveStart &&
                dateStr < activeEnd;
              const isPast = minDate ? dateStr < minDate : false;
              const isFutureBlocked = maxDate ? dateStr > maxDate : false;
              const isCellDisabled = disabled || isPast || isFutureBlocked;

              const todayStr = toDateString(new Date());
              const isToday = dateStr === todayStr;

              // Visual styling classes
              let containerBg = 'bg-transparent';
              if (isInRange) {
                containerBg = 'bg-blue-100/70 dark:bg-blue-600/20';
              } else if (isStart && !isSingleDay) {
                containerBg = 'bg-gradient-to-r from-transparent 50% to-blue-100/70 dark:to-blue-600/20 50%';
              } else if (isEnd && !isSingleDay) {
                containerBg = 'bg-gradient-to-r from-blue-100/70 dark:from-blue-600/20 50% to-transparent 50%';
              }

              return (
                <div
                  key={dateStr}
                  className={`relative flex h-9 sm:h-10 items-center justify-center ${containerBg}`}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(dateStr)}
                    onMouseEnter={() => {
                      if (isPickingEnd) setHoverDate(dateStr);
                    }}
                    disabled={isCellDisabled}
                    title={dateStr}
                    className={`relative z-10 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-xs font-semibold transition-all select-none ${
                      isStart || isEnd
                        ? 'bg-[#007AFF] text-white shadow-sm font-bold scale-105'
                        : isInRange
                          ? 'text-[#007AFF] dark:text-[#3894FF] font-semibold hover:bg-blue-200/50 dark:hover:bg-blue-500/30'
                          : isCurrentMonth
                            ? 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10'
                            : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5'
                    } ${isToday && !isStart && !isEnd ? 'ring-1.5 ring-[#007AFF] text-[#007AFF] font-bold' : ''} ${
                      isCellDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {dayNum}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Instructional bottom bar */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-2.5 text-[11px] text-slate-500 dark:text-[#A1A1AA]">
            <span>
              {isPickingEnd ? (
                <span className="font-semibold text-[#007AFF] dark:text-[#3894FF] animate-pulse">
                  Click another date to complete the range
                </span>
              ) : (
                'Click a start date, then an end date'
              )}
            </span>
            {isPickingEnd && (
              <button
                type="button"
                onClick={() => {
                  setIsPickingEnd(false);
                  setHoverDate(null);
                }}
                className="text-[10px] font-semibold text-rose-500 hover:underline"
              >
                Cancel selection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
