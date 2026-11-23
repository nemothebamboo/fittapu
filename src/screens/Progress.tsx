import { useMemo, useState } from 'react';
import { useData } from '../store';
import { Card, Modal, NumInput } from '../components/ui';
import { BarChart, LineChart } from '../components/charts';
import type { Series } from '../components/charts';
import { GOAL_DATE, GOAL_WEIGHT, REALISTIC_WEIGHT, START_DATE, START_WEIGHT, STEP_GOAL } from '../config';
import { addDays, fmtDate, int, iso, mondayISO, num, parseISO, shiftWeek, weekNo } from '../dates';
import { t, trend, weights } from '../stats';
import type { Measure } from '../types';

const FIELDS: [keyof Measure, string, string][] = [
  ['waist', 'Derék', 'cm'],
  ['hip', 'Csípő', 'cm'],
  ['thigh', 'Comb', 'cm'],
  ['chest', 'Mellkas', 'cm'],
  ['arm', 'Kar', 'cm'],
  ['pushups', 'Max fekvő', 'db'],
  ['pullups', 'Max húzódzkodás', 'db'],
];

export default function Progress() {
  const { days, measures, saveMeasure, deleteMeasure } = useData();
  const [form, setForm] = useState<Measure | null>(null);
  const w = useMemo(() => weights(days), [days]);
  const cur = w.length ? w[w.length - 1].y : START_WEIGHT;
  const tr = trend(w);
  const goalX = t(GOAL_DATE);
  const xMax = Math.max(goalX, w.length ? w[w.length - 1].x : 0);

  const series: Series[] = [
    { label: 'Súly', color: 'var(--accent)', points: w, dots: true },
    { label: `Cél ${GOAL_WEIGHT} kg`, color: 'var(--bad)', dashed: true, points: [{ x: t(START_DATE), y: START_WEIGHT }, { x: goalX, y: GOAL_WEIGHT }] },
    { label: `Reális ~${num(REALISTIC_WEIGHT)} kg`, color: 'var(--good)', dashed: true, points: [{ x: t(START_DATE), y: START_WEIGHT }, { x: goalX, y: REALISTIC_WEIGHT }] },
  ];
  if (tr) series.push({ label: 'Trend', color: 'var(--warn)', dashed: true, points: [{ x: tr.from, y: tr.at(tr.from) }, { x: goalX, y: tr.at(goalX) }] });

  const ms = [...measures].sort((a, b) => a.date.localeCompare(b.date));
  const strength: Series[] = [
    { label: 'Max fekvő', color: 'var(--accent)', dots: true, points: ms.filter((m) => m.pushups != null).map((m) => ({ x: t(m.date), y: m.pushups! })) },
    { label: 'Max húzódzkodás', color: 'var(--good)', dots: true, points: ms.filter((m) => m.pullups != null).map((m) => ({ x: t(m.date), y: m.pullups! })) },
  ];
  const lastMeasure = (k: keyof Measure) => [...ms].reverse().find((m) => m[k] != null)?.[k] as number | undefined;
  const firstMeasure = (k: keyof Measure) => ms.find((m) => m[k] != null)?.[k] as number | undefined;

  const cindy = Object.values(days).filter((d) => d.cindyRounds).sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => iso(addDays(today, i - 13)));
  const stepBars = last14.map((d) => ({ label: String(parseISO(d).getDate()), value: days[d]?.steps ?? 0 }));
  const avg = (arr: string[]) => {
    const v = arr.map((d) => days[d]?.steps).filter((x): x is number => !!x);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const weeksBack = Array.from({ length: 8 }, (_, i) => shiftWeek(mondayISO(today), i - 7));
  const callBars = weeksBack.map((m) => ({
    label: `${weekNo(parseISO(m))}.`,
    value: Array.from({ length: 7 }, (_, i) => days[iso(addDays(parseISO(m), i))]?.calls ?? 0).reduce((a, b) => a + b, 0),
  }));
  const meetings = weeksBack.map((m) => Array.from({ length: 7 }, (_, i) => days[iso(addDays(parseISO(m), i))]?.meetings ?? 0).reduce((a, b) => a + b, 0));

  return (
    <div className="screen">
      <h1 className="screen-title">Haladás</h1>
      <div className="stats">
        <div><small>Most</small><b>{num(cur)} kg</b></div>
        <div><small>Változás</small><b className={cur <= START_WEIGHT ? 'good' : 'bad'}>{cur - START_WEIGHT > 0 ? '+' : ''}{num(cur - START_WEIGHT)} kg</b></div>
        <div><small>Célig</small><b>{num(Math.max(0, cur - GOAL_WEIGHT))} kg</b></div>
      </div>

      <Card title="Súly">
        <LineChart series={series} xMin={t(START_DATE)} xMax={xMax} />
        {tr ? (
          <p className="muted">Trend: {tr.perWeek > 0 ? '+' : ''}{num(tr.perWeek, 2)} kg/hét. Ezzel febr. 1-re kb. {num(tr.at(goalX))} kg.</p>
        ) : (
          <p className="muted">A trendvonalhoz legalább két mérés kell (szombat reggel).</p>
        )}
      </Card>

      <Card title="Körméretek és erő" right={<button className="btn small primary" onClick={() => setForm({ date: iso(new Date()) })}>+ Mérés</button>}>
        <div className="measure-grid">
          {FIELDS.map(([k, l, u]) => {
            const a = firstMeasure(k), b = lastMeasure(k);
            const diff = a != null && b != null ? b - a : null;
            return (
              <div key={k}>
                <small>{l}</small>
                <b>{b != null ? `${num(b, k === 'pushups' || k === 'pullups' ? 0 : 1)} ${u}` : '–'}</b>
                {diff != null && diff !== 0 && <em className={(k === 'pushups' || k === 'pullups') === diff > 0 ? 'good' : 'bad'}>{diff > 0 ? '+' : ''}{num(diff, k === 'pushups' || k === 'pullups' ? 0 : 1)}</em>}
              </div>
            );
          })}
        </div>
        <p className="muted">Körméret kéthetente, szombat reggel.</p>
        <LineChart series={strength} />
        <details>
          <summary>Összes mérés ({ms.length})</summary>
          <ul className="measure-list">
            {[...ms].reverse().map((m) => (
              <li key={m.date}>
                <button className="link-btn" onClick={() => setForm(m)}>{fmtDate(parseISO(m.date))}</button>
                <span>{FIELDS.filter(([k]) => m[k] != null).map(([k, l]) => `${l.toLowerCase()} ${m[k]}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card title="Cindy körök">
        <LineChart series={[{ label: 'Körök', color: 'var(--good)', dots: true, points: cindy.map((d) => ({ x: t(d.date), y: d.cindyRounds! })) }]} />
      </Card>

      <Card title="Lépések (14 nap)" right={<span className="pill">7 napos átlag: {int(avg(last14.slice(7)))}</span>}>
        <BarChart bars={stepBars} target={STEP_GOAL} />
      </Card>

      <Card title="Cold calling (heti hívás)" right={<span className="pill">e heti meeting: {meetings[7]}</span>}>
        <BarChart bars={callBars} color="#0090ff" />
      </Card>

      {form && <MeasureForm m={form} onClose={() => setForm(null)} onSave={(m) => { saveMeasure(m); setForm(null); }} onDelete={(d) => { deleteMeasure(d); setForm(null); }} exists={measures.some((x) => x.date === form.date)} />}
    </div>
  );
}

function MeasureForm({ m, onClose, onSave, onDelete, exists }: { m: Measure; onClose: () => void; onSave: (m: Measure) => void; onDelete: (date: string) => void; exists: boolean }) {
  const [x, setX] = useState<Measure>(m);
  return (
    <Modal title="Mérés" onClose={onClose}>
      <div className="form">
        <label>Dátum<input type="date" value={x.date} onChange={(e) => setX({ ...x, date: e.target.value })} /></label>
        <div className="row2 wrap">
          {FIELDS.map(([k, l, u]) => (
            <label key={k}>{l} ({u})
              <NumInput decimal value={x[k] as number | undefined} onChange={(v) => setX({ ...x, [k]: v })} />
            </label>
          ))}
        </div>
        <div className="form-actions">
          {exists && <button className="btn danger" onClick={() => confirm('Törlöd ezt a mérést?') && onDelete(x.date)}>Törlés</button>}
          <button className="btn primary" onClick={() => onSave(x)}>Mentés</button>
        </div>
      </div>
    </Modal>
  );
}
