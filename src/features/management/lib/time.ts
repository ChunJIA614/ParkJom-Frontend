/**
 * Date helpers for the management workspace.
 *
 * The backend stores booking windows as Malaysia local time without an offset
 * (the plate check compares them with `UtcNow + 8h`), while access events and
 * plate-check logs are UTC. Every value is displayed in Asia/Kuala_Lumpur so a
 * guard and an administrator abroad read the same clock.
 */

export const PROPERTY_TIME_ZONE = 'Asia/Kuala_Lumpur';

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Parse a backend naive local (MYT) timestamp. */
export function parseLocalMyt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(HAS_ZONE.test(value) ? value : `${value}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Parse a backend UTC timestamp that may be serialized without a `Z`. */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(HAS_ZONE.test(value) ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const timeFormatter = new Intl.DateTimeFormat('en-MY', {
  timeZone: PROPERTY_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat('en-MY', {
  timeZone: PROPERTY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

const fullFormatter = new Intl.DateTimeFormat('en-MY', {
  timeZone: PROPERTY_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROPERTY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** yyyy-MM-dd for a date as seen in Malaysia. */
export function mytDateKey(date: Date = new Date()): string {
  return keyFormatter.format(date);
}

export function formatTime(date: Date | null): string {
  return date ? timeFormatter.format(date) : '—';
}

export function formatFull(date: Date | null): string {
  return date ? fullFormatter.format(date) : '—';
}

/** "Today, 9:30 am", "Yesterday, 6:10 pm", or "12 Nov, 8:00 am". */
export function formatRelativeDay(date: Date | null, now: Date = new Date()): string {
  if (!date) return '—';
  const key = mytDateKey(date);
  const today = mytDateKey(now);
  const yesterday = mytDateKey(new Date(now.getTime() - 86_400_000));
  const tomorrow = mytDateKey(new Date(now.getTime() + 86_400_000));
  const day = key === today ? 'Today'
    : key === yesterday ? 'Yesterday'
      : key === tomorrow ? 'Tomorrow'
        : dayFormatter.format(date);
  return `${day}, ${timeFormatter.format(date)}`;
}

/** A booking window such as "Today, 8:00 am – 6:00 pm" or across days. */
export function formatWindow(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  if (mytDateKey(start) === mytDateKey(end)) {
    return `${formatRelativeDay(start)} – ${formatTime(end)}`;
  }
  return `${formatRelativeDay(start)} – ${formatRelativeDay(end)}`;
}

/** Human "5 min ago" for recent UTC events, falling back to the day format. */
export function formatAgo(date: Date | null, now: Date = new Date()): string {
  if (!date) return '—';
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 6) return `${hours} hr ago`;
  return formatRelativeDay(date, now);
}
