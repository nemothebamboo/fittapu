export const DAY = 1440;
export const WEEK = 7 * DAY;

export const pad = (n: number) => String(n).padStart(2, '0');

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** hétfő = 0 ... vasárnap = 6 */
export function dayIdx(d: Date): number {
  return (d.getDay() + 6) % 7;
}
export function mondayOf(d: Date): Date {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -dayIdx(d));
}
export function mondayISO(d: Date): string {
  return iso(mondayOf(d));
}
export function shiftWeek(monday: string, n: number): string {
  return iso(addDays(parseISO(monday), 7 * n));
}
/** hét-perc → valódi dátum */
export function weekMinToDate(monday: string, min: number): Date {
  const m = parseISO(monday);
  return new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, min);
}
export function hm(min: number): string {
  const m = ((Math.round(min) % DAY) + DAY) % DAY;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
export function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function durText(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} p`;
  return m ? `${h} ó ${m} p` : `${h} ó`;
}
export const DAY_NAMES = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
export const DAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
export function fmtDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}.`;
}
export function weekLabel(monday: string): string {
  const m = parseISO(monday);
  return `${fmtDate(m)} – ${fmtDate(addDays(m, 6))}`;
}
/** ISO hét sorszám */
export function weekNo(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}
export const num = (n: number, digits = 1) =>
  n.toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const int = (n: number) => Math.round(n).toLocaleString('hu-HU');
