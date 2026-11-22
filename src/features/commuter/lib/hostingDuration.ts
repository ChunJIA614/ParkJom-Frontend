import { displayDateKey, parseTimestamp, type Timestamp } from '@/lib/dateTime';

/** Age of this listing, rather than the owner's overall hosting experience. */
export function formatHostingDuration(createdAt: Timestamp, now = new Date()): string | null {
  const created = parseTimestamp(createdAt);
  if (!Number.isFinite(created.getTime()) || !Number.isFinite(now.getTime()) || created > now) return null;
  const [year, month, day] = displayDateKey(created).split('-').map(Number);
  const [nowYear, nowMonth, nowDay] = displayDateKey(now).split('-').map(Number);
  const months = (nowYear - year) * 12 + nowMonth - month - (nowDay < day ? 1 : 0);
  const years = Math.floor(months / 12);
  if (years >= 1) return 'Hosted for ' + years + (years === 1 ? ' year' : ' years');
  if (months >= 1) return 'Hosted for ' + months + (months === 1 ? ' month' : ' months');
  const days = Math.floor((now.getTime() - created.getTime()) / 86_400_000);
  if (days >= 1) return 'Hosted for ' + days + (days === 1 ? ' day' : ' days');
  return 'Hosted for less than a day';
}
