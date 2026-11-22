/** Display zone only: never add eight hours to an instant or outgoing API data. */
export const DISPLAY_TIME_ZONE = import.meta.env?.VITE_TIME_ZONE || 'Asia/Kuala_Lumpur';
// Fail early for an invalid deployment setting rather than silently using the device zone.
new Intl.DateTimeFormat('en-MY', { timeZone: DISPLAY_TIME_ZONE });

export type Timestamp = string | number | Date | null | undefined;

/** Unix seconds/milliseconds (including numeric strings), ISO dates, and Date objects. */
export function parseTimestamp(value: Timestamp): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (value === null || value === undefined || value === '') return new Date(NaN);
  if (typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const number = Number(value);
    return new Date(Math.abs(number) < 100_000_000_000 ? number * 1000 : number);
  }
  return new Date(value);
}

export function displayDateOptions(options: Intl.DateTimeFormatOptions = {}, calendarOnly = false): Intl.DateTimeFormatOptions {
  return calendarOnly ? options : { ...options, timeZone: DISPLAY_TIME_ZONE };
}

/** Stable calendar key in the configured display zone, including day rollovers. */
export function displayDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', displayDateOptions({
    year: 'numeric', month: '2-digit', day: '2-digit',
  })).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return [part('year'), part('month'), part('day')].join('-');
}
