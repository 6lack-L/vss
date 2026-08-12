/** Presentation helpers shared across components. */

const MS_PER_DAY = 86_400_000;

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Whole days until `expiresAt`. Negative once expired, null when a listing
 * never expires. Replaces the prototype's hardcoded "Days Left: 4".
 */
export function daysLeft(expiresAt: string | null | undefined, now = new Date()): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / MS_PER_DAY);
}

export function expiryLabel(expiresAt: string | null | undefined, now = new Date()) {
  const days = daysLeft(expiresAt, now);
  if (days === null) return null;
  if (days < 0) return { text: 'Closed', tone: 'danger' as const };
  if (days === 0) return { text: 'Last day', tone: 'danger' as const };
  if (days === 1) return { text: '1 day left', tone: 'warning' as const };
  if (days <= 3) return { text: `${days} days left`, tone: 'warning' as const };
  return { text: `${days} days left`, tone: 'neutral' as const };
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', MS_PER_DAY],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "3 hours ago" — rendered on the server, refreshed client-side by RelativeTime. */
export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = then - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Truncate for meta descriptions and card previews, on a word boundary. */
export function excerpt(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(' ', max - 1)).trimEnd() + '…';
}
