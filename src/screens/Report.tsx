import { useMemo, useState } from 'react';
import { useData } from '../store';
import { absBlocks, checklist, dayBlocks, isFastDay } from '../schedule';
import { addDays, DAY_SHORT, int, iso, mondayISO, num, parseISO, shiftWeek, weekLabel, weekNo } from '../dates';
import { Card, NavHeader } from '../components/ui';
import { GOAL_WEIGHT, START_WEIGHT, STEP_GOAL } from '../config';
import { realisticAt, weights } from '../stats';
import type { ReportRec } from '../types';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function Report() {
  const { days, weekBlocks, measures, reports, saveReport } = useData();
  const [monday, setMonday] = useState(() => mondayISO(new Date()));
  const [copied, setCopied] = useState(false);
  const rep: ReportRec = reports[monday] ?? { monday, good: '', hard: '', focus: '' };
  const abs = useMemo(() => absBlocks(monday, weekBlocks), [monday, weekBlocks]);
  const dates = Array.from({ length: 7 }, (_, i) => iso(addDays(parseISO(monday), i)));
  const sunday = dates[6];

  const s = useMemo(() => {
    let done = 0, total = 0;
    const perDay: string[] = [];
    let pushDays = 0, bedDays = 0, waterDays = 0, stepDays = 0;
    const stepVals: number[] = [];
    let calls = 0, reached = 0, meetings = 0, target = 0;
    let cindyPlanned = 0, cindyDone = 0, extraPlanned = 0, extraDone = 0, plasmaPlanned = 0, plasmaDone = 0;
    const rounds: number[] = [];
    dates.forEach((d, di) => {
      const rec = days[d];
      const items = checklist(abs, di, rec);
      const dd = items.filter((i) => i.done).length;
      done += dd; total += items.length;
      perDay.push(`${DAY_SHORT[di]} ${Math.round((dd / Math.max(1, items.length)) * 100)}%`);
      const get = (k: string) => items.find((i) => i.key === k);
      if (get('pushups')?.done) pushDays++;
      if (get('bed')?.done) bedDays++;
      if (get('water')?.done) waterDays++;
      if (get('steps')?.done) stepDays++;
      if (get('cindy')) { cindyPlanned++; if (get('cindy')!.done) cindyDone++; }
      if (get('extra')) { extraPlanned++; if (get('extra')!.done) extraDone++; }
      if (get('plasma')) { plasmaPlanned++; if (get('plasma')!.done) plasmaDone++; }
      if (rec?.cindyRounds) rounds.push(rec.cindyRounds);
      if (rec?.steps) stepVals.push(rec.steps);
      calls += rec?.calls ?? 0; reached += rec?.reached ?? 0; meetings += rec?.meetings ?? 0;
      target += dayBlocks(abs, di).filter((b) => b.type === 'call').reduce((a, b) => a + (b.target ?? 0), 0);
    });
    const fastBlock = abs.find((b) => b.cur && b.type === 'fast');
    let fast = 'nem volt tervezve';
    if (fastBlock?.skipped) fast = 'kihagyva (plazma szabály)';
    else if (fastBlock) fast = isFastDay(abs, 6) && days[sunday]?.done?.fast ? 'megtartva ✅' : 'nincs kipipálva';
    const all = weights(days);
    const inWeek = all.filter((w) => w.date >= dates[0] && w.date <= sunday);
    const before = all.filter((w) => w.date < dates[0]);
    const wStart = before.length ? before[before.length - 1].y : inWeek[0]?.y;
    const wEnd = inWeek.length ? inWeek[inWeek.length - 1].y : undefined;
    const m = measures.filter((x) => x.date >= dates[0] && x.date <= sunday).sort((a, b) => b.date.localeCompare(a.date))[0];
    return { done, total, perDay, pushDays, bedDays, waterDays, stepDays, stepVals, calls, reached, meetings, target, cindyPlanned, cindyDone, extraPlanned, extraDone, plasmaPlanned, plasmaDone, rounds, fast, wStart, wEnd, m };
  }, [abs, days, measures, monday]);

  const pct = Math.round((s.done / Math.max(1, s.total)) * 100);
  const stepAvg = s.stepVals.length ? s.stepVals.reduce((a, b) => a + b, 0) / s.stepVals.length : 0;
  const real = realisticAt(sunday);
  const weightLine = s.wEnd != null
    ? `${s.wStart != null ? `${num(s.wStart)} → ` : ''}${num(s.wEnd)} kg${s.wStart != null ? ` (${s.wEnd - s.wStart > 0 ? '+' : ''}${num(s.wEnd - s.wStart)} kg)` : ''}`
    : 'nincs mérés';
  const m = s.m;
  const measureLine = m
    ? [['derék', m.waist], ['csípő', m.hip], ['comb', m.thigh], ['mell', m.chest], ['kar', m.arm], ['max fekvő', m.pushups], ['húzódzkodás', m.pullups]]
        .filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(', ')
    : '';

  const text = [
    `Fittapu heti jelentés – ${weekNo(parseISO(monday))}. hét (${weekLabel(monday)})`,
    '',
    `Súly: ${weightLine}`,
    `Pálya: reális ~${num(real)} kg | összesen ${s.wEnd != null ? num(s.wEnd - START_WEIGHT) : '–'} kg | célig ${s.wEnd != null ? num(s.wEnd - GOAL_WEIGHT) : '–'} kg`,
    `Napi lista: ${pct}% (${s.done}/${s.total}) – ${s.perDay.join(', ')}`,
    `Edzés: Cindy ${s.cindyDone}/${s.cindyPlanned}${s.rounds.length ? ` (körök: ${s.rounds.join(', ')})` : ''}, kiegészítő ${s.extraDone}/${s.extraPlanned}, 100 fekvő ${s.pushDays}/7 nap`,
    `Plazma: ${s.plasmaDone}/${s.plasmaPlanned} | Böjt: ${s.fast}`,
    `Lépés: átlag ${int(stepAvg)}/nap, ${STEP_GOAL / 1000}k fölött ${s.stepDays}/7 nap`,
    `Víz cél: ${s.waterDays}/7 nap | Időben lefekvés: ${s.bedDays}/7 nap`,
    `Cold calling: ${s.calls} hívás${s.target ? ` / ${s.target} cél` : ''}, ${s.reached} elért, ${s.meetings} meeting`,
    measureLine ? `Mérés: ${measureLine}` : '',
    '',
    `Mi ment jól: ${rep.good || '–'}`,
    `Mi volt nehéz: ${rep.hard || '–'}`,
    `Jövő heti fókusz: ${rep.focus || '–'}`,
  ].filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '').join('\n');

  const setRep = (p: Partial<ReportRec>) => saveReport({ ...rep, ...p });

  return (
    <div className="screen">
      <NavHeader label={`${weekNo(parseISO(monday))}. hét`} sub={weekLabel(monday)} onPrev={() => setMonday(shiftWeek(monday, -1))} onNext={() => setMonday(shiftWeek(monday, 1))} onToday={() => setMonday(mondayISO(new Date()))} />
      <div className="stats">
        <div><small>Napi lista</small><b>{pct}%</b></div>
        <div><small>Súly</small><b>{s.wEnd != null ? `${num(s.wEnd)} kg` : '–'}</b></div>
        <div><small>Hívás</small><b>{s.calls}</b></div>
      </div>
      <Card title="Saját megjegyzés">
        <div className="form">
          <label>Mi ment jól?<textarea rows={2} value={rep.good} onChange={(e) => setRep({ good: e.target.value })} /></label>
          <label>Mi volt nehéz?<textarea rows={2} value={rep.hard} onChange={(e) => setRep({ hard: e.target.value })} /></label>
          <label>Jövő heti fókusz<textarea rows={2} value={rep.focus} onChange={(e) => setRep({ focus: e.target.value })} /></label>
        </div>
      </Card>
      <Card title="Jelentés" right={<button className="btn small primary" onClick={async () => { if (await copy(text)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Másolva ✓' : 'Másolás'}</button>}>
        <pre className="report-text">{text}</pre>
        <p className="muted">Vasárnap este másold ki, és illeszd be a Fittapu projektbe.</p>
      </Card>
    </div>
  );
}
