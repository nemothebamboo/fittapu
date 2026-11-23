import type { DayRec } from './types';
import { GOAL_DATE, GOAL_WEIGHT, REALISTIC_WEIGHT, START_DATE, START_WEIGHT } from './config';
import { parseISO } from './dates';

export const t = (s: string) => parseISO(s).getTime();

export function weights(days: Record<string, DayRec>) {
  return Object.values(days)
    .filter((d) => d.weight != null && d.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, x: t(d.date), y: d.weight! }));
}

/** a reális és a cél pálya értéke egy adott napon */
export function pathAt(date: string, target: number) {
  const s = t(START_DATE), e = t(GOAL_DATE);
  const k = Math.min(1, Math.max(0, (t(date) - s) / (e - s)));
  return START_WEIGHT + (target - START_WEIGHT) * k;
}
export const realisticAt = (date: string) => pathAt(date, REALISTIC_WEIGHT);
export const goalAt = (date: string) => pathAt(date, GOAL_WEIGHT);

/** lineáris regresszió az utolsó 28 nap mérésein */
export function trend(points: { x: number; y: number }[]) {
  if (points.length < 2) return null;
  const last = points[points.length - 1].x;
  const p = points.filter((q) => q.x >= last - 28 * 86400000);
  if (p.length < 2) return null;
  const n = p.length;
  const mx = p.reduce((s, q) => s + q.x, 0) / n;
  const my = p.reduce((s, q) => s + q.y, 0) / n;
  const num = p.reduce((s, q) => s + (q.x - mx) * (q.y - my), 0);
  const den = p.reduce((s, q) => s + (q.x - mx) ** 2, 0);
  if (!den) return null;
  const slope = num / den;
  const at = (x: number) => my + slope * (x - mx);
  return { at, perWeek: slope * 7 * 86400000, from: p[0].x };
}
