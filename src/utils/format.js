/** Amounts from the API are integers in the smallest unit (paise). */
export function money(minor, currency = 'INR') {
  if (minor === null || minor === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
}

/** Rupee input ("1,250.50") → paise (125050). Returns null when not a valid amount. */
export function toMinor(value) {
  const s = String(value ?? '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
export const fromMinor = (minor) => (minor === null || minor === undefined ? '' : (minor / 100).toFixed(2));

/** Date-only values arrive as UTC midnight; show the date part without timezone drift. */
export function date(value, opts = {}) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC', ...opts });
}
export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/** YYYY-MM-DD for inputs from a UTC-midnight date value. */
export const ymd = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const pct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1).replace(/\.0$/, '')}%`);
export const titleCase = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
export const ROLE_LABELS = { school_owner: 'Owner', school_admin: 'Admin', principal: 'Principal', accountant: 'Accountant', teacher: 'Teacher', staff: 'Staff', parent: 'Parent', student: 'Student' };
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
