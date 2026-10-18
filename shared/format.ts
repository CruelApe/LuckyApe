/** Display formatting that behaves identically on Hermes, Node and the web (no Intl dependence). */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 8145060 -> "8,145,060" */
export function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 6000000 -> "$6M", 1720003 -> "$1.72M", 155000 -> "$155,000", null -> "—" */
export function formatJackpot(amount: number | null): string {
  if (amount === null) return '—';
  if (amount >= 1_000_000) {
    const millions = Math.round((amount / 1_000_000) * 100) / 100;
    return `$${millions}M`;
  }
  return `$${formatInt(amount)}`;
}

/** "2026-10-17" -> "Sat 17 Oct 2026" */
export function formatDate(isoDate: string | null): string {
  const match = isoDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '—';
  const [, y, m, d] = match.map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** 3 -> "3 hours ago" style age, for cache freshness. */
export function formatAge(isoTimestamp: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(isoTimestamp)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** 678755 -> "1 in 678,755" */
export function formatOdds(oneIn: number): string {
  return `1 in ${formatInt(oneIn)}`;
}
