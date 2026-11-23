import type { Block, BlockType, DayRec } from './types';
import { DAY, WEEK, hm, parseISO, dayIdx, mondayISO, shiftWeek, weekMinToDate, durText } from './dates';
import { STEP_GOAL, WATER_BASE } from './config';

export const TYPE_META: Record<BlockType, { label: string; color: string }> = {
  plasma: { label: 'Plazma', color: '#e5484d' },
  fast: { label: 'Böjt', color: '#8e4ec6' },
  cindy: { label: 'Cindy', color: '#30a46c' },
  extra: { label: 'Kiegészítő edzés', color: '#12a594' },
  mealprep: { label: 'Meal prep', color: '#f76b15' },
  call: { label: 'Cold calling', color: '#0090ff' },
  sleep: { label: 'Alvás', color: '#3b4252' },
  other: { label: 'Egyéb', color: '#8b8d98' },
};
export const TYPE_ORDER: BlockType[] = ['call', 'cindy', 'extra', 'plasma', 'fast', 'mealprep', 'sleep', 'other'];

let counter = 0;
export const uid = () => Math.random().toString(36).slice(2, 9) + (counter++).toString(36);

const at = (d: number, h: number, m = 0) => d * DAY + h * 60 + m;

export function defaultBlocks(): Block[] {
  const b: Block[] = [];
  const add = (type: BlockType, start: number, dur: number, extra: Partial<Block> = {}) =>
    b.push({ id: uid(), type, title: TYPE_META[type].label, start, dur, ...extra });
  for (let d = 0; d < 7; d++) {
    // P és Szo este később fekszik, Szo/V 7:00 kel
    if (d === 4 || d === 5) add('sleep', at(d, 22), 9 * 60);
    else add('sleep', at(d, 20, 30), 6 * 60 + 55);
  }
  add('extra', at(0, 9), 40);
  add('plasma', at(1, 13, 30), 75, { title: 'Plazma (ebéd után)' });
  add('plasma', at(4, 13, 30), 75, { title: 'Plazma (ebéd után)' });
  add('cindy', at(2, 9), 30);
  add('cindy', at(3, 9), 30);
  add('cindy', at(5, 9), 30);
  add('mealprep', at(2, 19, 15), 60, { title: 'Meal prep (rövid)' });
  add('mealprep', at(5, 14), 90);
  add('fast', at(5, 19), 33 * 60 + 45, { title: 'Böjt (Szo 19:00 → H 4:45)' });
  for (let d = 0; d < 5; d++) add('call', at(d, 15), 150, { target: 50 });
  return b;
}

/** Blokk a hét kontextusában: abs = perc az aktuális hét hétfőjéhez képest (előző hét negatív). */
export interface AbsBlock extends Block {
  abs: number;
  cur: boolean;
  monday: string;
}

export function absBlocks(monday: string, get: (m: string) => Block[]): AbsBlock[] {
  const out: AbsBlock[] = [];
  for (const off of [-1, 0, 1]) {
    const m = shiftWeek(monday, off);
    for (const b of get(m)) out.push({ ...b, abs: b.start + off * WEEK, cur: off === 0, monday: m });
  }
  return out;
}

const active = (b: Block) => !b.skipped;
const end = (b: AbsBlock) => b.abs + b.dur;
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export function isFastDay(abs: AbsBlock[], di: number): boolean {
  const s = di * DAY;
  return abs.some((b) => b.type === 'fast' && active(b) && overlap(b.abs, end(b), s, s + DAY) >= 720);
}

export function dayBlocks(abs: AbsBlock[], di: number): AbsBlock[] {
  return abs
    .filter((b) => active(b) && b.abs >= di * DAY && b.abs < (di + 1) * DAY)
    .sort((a, b) => a.abs - b.abs);
}

export interface Meal {
  key: string;
  time: number;
  label: string;
}
export function mealsFor(abs: AbsBlock[], di: number): Meal[] {
  if (isFastDay(abs, di)) return [];
  const s = di * DAY;
  const fastStart = abs.find((b) => b.type === 'fast' && active(b) && b.abs > s && b.abs < s + DAY);
  const fastEndToday = abs.find((b) => b.type === 'fast' && active(b) && end(b) > s && end(b) < s + DAY);
  const wd = ((di % 7) + 7) % 7;
  let times: [number, string][];
  if (wd === 5) times = [[7 * 60 + 30, 'Reggeli'], [13 * 60, 'Ebéd'], [16 * 60, 'Uzsonna'], [18 * 60 + 30, 'Vacsora']];
  else if (wd === 6) times = [[8 * 60, 'Reggeli'], [13 * 60, 'Ebéd'], [16 * 60, 'Uzsonna'], [19 * 60, 'Vacsora']];
  else times = [[4 * 60 + 45, 'Reggeli'], [13 * 60, 'Ebéd'], [16 * 60, 'Uzsonna'], [19 * 60, 'Vacsora']];
  return times
    .filter(([t]) => !fastStart || s + t < fastStart.abs)
    .filter(([t]) => !fastEndToday || s + t >= end(fastEndToday) - 1)
    .map(([t, l], i) => ({
      key: `meal${i}`,
      time: t,
      label: fastEndToday && i === 0 ? `${l} (böjt vége)` : l,
    }));
}

export interface CheckItem {
  key: string;
  label: string;
  sub?: string;
  auto?: boolean; // automatikusan számolt
  done: boolean;
  kind?: 'cindy' | 'calls' | 'plain';
}

export function waterTarget(abs: AbsBlock[], di: number) {
  return WATER_BASE + (dayBlocks(abs, di).some((b) => b.type === 'plasma') ? 1 : 0);
}

export function checklist(abs: AbsBlock[], di: number, rec: DayRec | undefined): CheckItem[] {
  const done = rec?.done ?? {};
  const items: CheckItem[] = [];
  const blocks = dayBlocks(abs, di);
  const has = (t: BlockType) => blocks.filter((b) => b.type === t);
  const plain = (key: string, label: string, sub?: string) =>
    items.push({ key, label, sub, done: !!done[key], kind: 'plain' });

  if (isFastDay(abs, di)) plain('fast', 'Böjt tartva', 'csak víz, kávé, tea');
  for (const m of mealsFor(abs, di)) plain(m.key, `${hm(m.time)} ${m.label}`);

  const plasma = has('plasma');
  if (plasma.length) {
    plain('plasma', 'Plazma leadva', `${hm(plasma[0].abs)}, utána nincs Cindy`);
    plain('protein', '+30 g fehérje', '220 g túró vagy 1 tonhal');
  }
  const cindy = has('cindy');
  if (cindy.length) items.push({ key: 'cindy', label: 'Cindy', sub: `${hm(cindy[0].abs)}, 20 perc AMRAP`, done: !!done.cindy, kind: 'cindy' });
  const extra = has('extra');
  if (extra.length) plain('extra', extra[0].title, hm(extra[0].abs));
  plain('pushups', '100 fekvőtámasz', 'akár több részletben');
  const calls = has('call');
  if (calls.length) {
    const target = calls.reduce((s, b) => s + (b.target ?? 0), 0);
    const mins = calls.reduce((s, b) => s + b.dur, 0);
    const reached = (rec?.calls ?? 0) >= target && target > 0;
    items.push({ key: 'calls', label: 'Cold calling', sub: `${hm(calls[0].abs)}, ${durText(mins)}, cél ${target} hívás`, done: !!done.calls || reached, kind: 'calls' });
  }
  const prep = has('mealprep');
  if (prep.length) plain('mealprep', prep[0].title, hm(prep[0].abs));
  if (di === 5) items.push({ key: 'weigh', label: 'Reggeli mérés', sub: 'éhgyomorra, WC után', auto: true, done: rec?.weight != null });
  items.push({ key: 'steps', label: `${(STEP_GOAL / 1000).toFixed(0)} 000 lépés`, sub: rec?.steps ? `${rec.steps.toLocaleString('hu-HU')} lépés` : 'írd be lent', auto: true, done: (rec?.steps ?? 0) >= STEP_GOAL });
  const wt = waterTarget(abs, di);
  items.push({ key: 'water', label: `${wt} liter víz`, sub: `${(rec?.water ?? 0).toLocaleString('hu-HU')} l eddig`, auto: true, done: (rec?.water ?? 0) >= wt });
  const sleep = has('sleep');
  if (sleep.length) plain('bed', `Lefekvés ${hm(sleep[0].abs)}`, 'képernyő le 30 perccel előtte');
  return items;
}

export interface Warning {
  msg: string;
  ids: string[];
  fix?: { label: string; skipId: string };
}

export function checkRules(abs: AbsBlock[]): Warning[] {
  const w: Warning[] = [];
  const act = abs.filter(active);
  const touchesCur = (...bs: AbsBlock[]) => bs.some((b) => b.cur);
  const plasmas = act.filter((b) => b.type === 'plasma').sort((a, b) => a.abs - b.abs);
  for (let i = 1; i < plasmas.length; i++) {
    const a = plasmas[i - 1], b = plasmas[i];
    const gap = (b.abs - a.abs) / 60;
    if (gap < 72 && touchesCur(a, b))
      w.push({ msg: `Két plazmaadás között csak ${Math.round(gap)} óra van (min. 72).`, ids: [a.id, b.id] });
  }
  for (const p of plasmas) {
    for (const f of act.filter((b) => b.type === 'fast')) {
      if (!touchesCur(p, f)) continue;
      let gap = 0;
      if (end(p) <= f.abs) gap = f.abs - end(p);
      else if (end(f) <= p.abs) gap = p.abs - end(f);
      if (gap < DAY)
        w.push({
          msg: `Plazma és böjt között csak ${Math.round(gap / 60)} óra van (min. 24). Ilyenkor a böjt marad el.`,
          ids: [p.id, f.id],
          fix: f.cur ? { label: 'Böjt kihagyása ezen a héten', skipId: f.id } : undefined,
        });
    }
    for (const c of act.filter((b) => b.type === 'cindy')) {
      if (c.cur && Math.floor(c.abs / DAY) === Math.floor(p.abs / DAY))
        w.push({ msg: 'Plazmanapon nincs Cindy.', ids: [p.id, c.id], fix: { label: 'Cindy kihagyása', skipId: c.id } });
    }
  }
  const normal = act.filter((b) => b.type !== 'sleep' && b.type !== 'fast');
  for (let i = 0; i < normal.length; i++)
    for (let j = i + 1; j < normal.length; j++) {
      const a = normal[i], b = normal[j];
      if (touchesCur(a, b) && overlap(a.abs, end(a), b.abs, end(b)) > 0)
        w.push({ msg: `Ütközés: ${a.title} és ${b.title}.`, ids: [a.id, b.id] });
    }
  const sleeps = act.filter((b) => b.type === 'sleep');
  for (const a of normal) {
    if (!a.cur) continue;
    const s = sleeps.find((x) => overlap(a.abs, end(a), x.abs, end(x)) > 0);
    if (s) w.push({ msg: `${a.title} alvásidőbe lóg (${hm(s.abs)}–${hm(end(s))}).`, ids: [a.id, s.id] });
  }
  return w;
}

export interface Ev {
  t: Date;
  label: string;
}
/** Események a mostani hét körül a visszaszámlálóhoz. */
export function events(monday: string, abs: AbsBlock[]): Ev[] {
  const ev: Ev[] = [];
  for (const b of abs.filter(active)) {
    if (b.type === 'sleep') ev.push({ t: weekMinToDate(monday, b.abs), label: 'Lefekvés' });
    else if (b.type === 'fast') {
      ev.push({ t: weekMinToDate(monday, b.abs), label: 'Böjt kezdete' });
      ev.push({ t: weekMinToDate(monday, end(b)), label: 'Böjt vége' });
    } else ev.push({ t: weekMinToDate(monday, b.abs), label: b.title });
  }
  for (let di = -1; di < 8; di++)
    for (const m of mealsFor(abs, di))
      if (!m.label.includes('böjt vége')) ev.push({ t: weekMinToDate(monday, di * DAY + m.time), label: m.label });
  return ev.sort((a, b) => a.t.getTime() - b.t.getTime());
}

export function currentFast(monday: string, abs: AbsBlock[], now: Date) {
  for (const b of abs.filter((x) => x.type === 'fast' && active(x))) {
    const s = weekMinToDate(monday, b.abs), e = weekMinToDate(monday, end(b));
    if (now >= s && now < e) return { start: s, end: e };
  }
  return null;
}

export const dateCtx = (date: string) => {
  const d = parseISO(date);
  return { monday: mondayISO(d), di: dayIdx(d) };
};
