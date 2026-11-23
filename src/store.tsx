import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Block, DayRec, ExportData, Measure, ReportRec, WeekRec } from './types';
import { defaultBlocks } from './schedule';
import { START_DATE, START_PULLUPS, START_PUSHUPS, START_WEIGHT } from './config';

type Stores = 'days' | 'weeks' | 'measures' | 'reports' | 'kv';

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = openDB('fittapu', 1, {
      upgrade(d) {
        d.createObjectStore('days', { keyPath: 'date' });
        d.createObjectStore('weeks', { keyPath: 'monday' });
        d.createObjectStore('measures', { keyPath: 'date' });
        d.createObjectStore('reports', { keyPath: 'monday' });
        d.createObjectStore('kv');
      },
    });
  return dbp;
}
const put = async (store: Stores, v: unknown, key?: string) => (await db()).put(store, v, key);

interface Data {
  days: Record<string, DayRec>;
  weeks: Record<string, WeekRec>;
  measures: Measure[];
  reports: Record<string, ReportRec>;
  template: Block[];
}

interface Store extends Data {
  ready: boolean;
  weekBlocks: (monday: string) => Block[];
  saveDay: (rec: DayRec) => void;
  saveWeek: (monday: string, blocks: Block[]) => void;
  resetWeek: (monday: string) => void;
  saveTemplate: (blocks: Block[]) => void;
  saveMeasure: (m: Measure) => void;
  deleteMeasure: (date: string) => void;
  saveReport: (r: ReportRec) => void;
  exportAll: () => ExportData;
  importAll: (d: ExportData) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const byKey = <T,>(arr: T[], k: keyof T) => Object.fromEntries(arr.map((x) => [x[k] as string, x]));

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({ days: {}, weeks: {}, measures: [], reports: {}, template: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await db();
      const [days, weeks, measures, reports] = await Promise.all([
        d.getAll('days') as Promise<DayRec[]>,
        d.getAll('weeks') as Promise<WeekRec[]>,
        d.getAll('measures') as Promise<Measure[]>,
        d.getAll('reports') as Promise<ReportRec[]>,
      ]);
      let template = (await d.get('kv', 'template')) as Block[] | undefined;
      const seeded = await d.get('kv', 'seeded');
      if (!seeded) {
        template = defaultBlocks();
        await d.put('kv', template, 'template');
        const day: DayRec = { date: START_DATE, done: {}, weight: START_WEIGHT };
        const m: Measure = { date: START_DATE, pushups: START_PUSHUPS, pullups: START_PULLUPS };
        await d.put('days', day);
        await d.put('measures', m);
        days.push(day);
        measures.push(m);
        await d.put('kv', true, 'seeded');
      }
      setData({ days: byKey(days, 'date'), weeks: byKey(weeks, 'monday'), measures, reports: byKey(reports, 'monday'), template: template ?? defaultBlocks() });
      setReady(true);
      navigator.storage?.persist?.().catch(() => {});
    })();
  }, []);

  const weekBlocks = useCallback((m: string) => data.weeks[m]?.blocks ?? data.template, [data.weeks, data.template]);

  const store = useMemo<Store>(
    () => ({
      ...data,
      ready,
      weekBlocks,
      saveDay: (rec) => {
        setData((s) => ({ ...s, days: { ...s.days, [rec.date]: rec } }));
        put('days', rec);
      },
      saveWeek: (monday, blocks) => {
        const rec = { monday, blocks };
        setData((s) => ({ ...s, weeks: { ...s.weeks, [monday]: rec } }));
        put('weeks', rec);
      },
      resetWeek: (monday) => {
        setData((s) => {
          const weeks = { ...s.weeks };
          delete weeks[monday];
          return { ...s, weeks };
        });
        db().then((d) => d.delete('weeks', monday));
      },
      saveTemplate: (blocks) => {
        setData((s) => ({ ...s, template: blocks }));
        put('kv', blocks, 'template');
      },
      saveMeasure: (m) => {
        setData((s) => ({ ...s, measures: [...s.measures.filter((x) => x.date !== m.date), m] }));
        put('measures', m);
      },
      deleteMeasure: (date) => {
        setData((s) => ({ ...s, measures: s.measures.filter((x) => x.date !== date) }));
        db().then((d) => d.delete('measures', date));
      },
      saveReport: (r) => {
        setData((s) => ({ ...s, reports: { ...s.reports, [r.monday]: r } }));
        put('reports', r);
      },
      exportAll: () => ({
        app: 'fittapu',
        version: 1,
        exportedAt: new Date().toISOString(),
        days: Object.values(data.days),
        weeks: Object.values(data.weeks),
        measures: data.measures,
        reports: Object.values(data.reports),
        template: data.template,
      }),
      importAll: async (x) => {
        if (x?.app !== 'fittapu') throw new Error('Ez nem Fittapu mentés.');
        const d = await db();
        const tx = d.transaction(['days', 'weeks', 'measures', 'reports', 'kv'], 'readwrite');
        for (const s of ['days', 'weeks', 'measures', 'reports'] as const) await tx.objectStore(s).clear();
        for (const r of x.days ?? []) await tx.objectStore('days').put(r);
        for (const r of x.weeks ?? []) await tx.objectStore('weeks').put(r);
        for (const r of x.measures ?? []) await tx.objectStore('measures').put(r);
        for (const r of x.reports ?? []) await tx.objectStore('reports').put(r);
        const template = x.template?.length ? x.template : defaultBlocks();
        await tx.objectStore('kv').put(template, 'template');
        await tx.objectStore('kv').put(true, 'seeded');
        await tx.done;
        setData({ days: byKey(x.days ?? [], 'date'), weeks: byKey(x.weeks ?? [], 'monday'), measures: x.measures ?? [], reports: byKey(x.reports ?? [], 'monday'), template });
      },
    }),
    [data, ready, weekBlocks],
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useData(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('DataProvider hiányzik');
  return s;
}
