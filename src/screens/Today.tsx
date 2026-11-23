import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store';
import { absBlocks, checklist, currentFast, dateCtx, events, waterTarget } from '../schedule';
import { addDays, DAY_NAMES, fmtDate, iso, mondayISO, parseISO, durText } from '../dates';
import type { DayRec } from '../types';
import { Card, NavHeader, NumInput, Stepper } from '../components/ui';

function useNow(ms = 20000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    const v = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [ms]);
  return now;
}

function Countdown() {
  const { weekBlocks } = useData();
  const now = useNow();
  const monday = mondayISO(now);
  const abs = useMemo(() => absBlocks(monday, weekBlocks), [monday, weekBlocks]);
  const fast = currentFast(monday, abs, now);
  const next = events(monday, abs).find((e) => e.t > now);
  const mins = (d: Date) => Math.max(0, Math.round((d.getTime() - now.getTime()) / 60000));
  return (
    <div className="countdown">
      {fast && (
        <div className="fast-box">
          <div className="cd-label">Böjt folyamatban</div>
          <div className="cd-big">még {durText(mins(fast.end))}</div>
          <div className="bar"><div style={{ width: `${Math.min(100, ((now.getTime() - fast.start.getTime()) / (fast.end.getTime() - fast.start.getTime())) * 100)}%` }} /></div>
          <div className="cd-sub">vége: {DAY_NAMES[(fast.end.getDay() + 6) % 7].toLowerCase()} {fast.end.toTimeString().slice(0, 5)}</div>
        </div>
      )}
      {next && (
        <div>
          <div className="cd-label">Következő</div>
          <div className="cd-big">{next.label}</div>
          <div className="cd-sub">{next.t.toTimeString().slice(0, 5)} · {durText(mins(next.t))} múlva</div>
        </div>
      )}
    </div>
  );
}

export default function Today() {
  const { days, saveDay, weekBlocks } = useData();
  const [date, setDate] = useState(() => iso(new Date()));
  const { monday, di } = dateCtx(date);
  const abs = useMemo(() => absBlocks(monday, weekBlocks), [monday, weekBlocks]);
  const rec: DayRec = days[date] ?? { date, done: {} };
  const items = checklist(abs, di, rec);
  const set = (patch: Partial<DayRec>) => saveDay({ ...rec, ...patch });
  const toggle = (k: string) => set({ done: { ...rec.done, [k]: !rec.done[k] } });
  const doneCount = items.filter((i) => i.done).length;
  const isToday = date === iso(new Date());
  const d = parseISO(date);
  const wt = waterTarget(abs, di);

  return (
    <div className="screen">
      <NavHeader
        label={isToday ? 'Ma' : DAY_NAMES[di]}
        sub={`${DAY_NAMES[di].toLowerCase()}, ${fmtDate(d)}`}
        onPrev={() => setDate(iso(addDays(d, -1)))}
        onNext={() => setDate(iso(addDays(d, 1)))}
        onToday={() => setDate(iso(new Date()))}
      />
      {isToday && <Countdown />}

      <Card title="Gyors bevitel">
        <div className="quick">
          <label>
            <span>Súly (kg){di === 5 ? ' · mérőnap' : ''}</span>
            <NumInput decimal step={0.1} placeholder="pl. 91,8" value={rec.weight} onChange={(v) => set({ weight: v })} />
          </label>
          <label>
            <span>Lépés</span>
            <NumInput placeholder="pl. 11000" value={rec.steps} onChange={(v) => set({ steps: v })} />
          </label>
        </div>
        <Stepper label={`Víz (cél ${wt} l)`} unit="l" step={0.5} value={rec.water ?? 0} onChange={(v) => set({ water: v })} />
      </Card>

      <Card title="Napi lista" right={<span className="pill">{doneCount}/{items.length}</span>}>
        <div className="bar"><div style={{ width: `${(doneCount / Math.max(1, items.length)) * 100}%` }} /></div>
        <ul className="checklist">
          {items.map((it) => (
            <li key={it.key} className={it.done ? 'done' : ''}>
              <button className="check-row" onClick={() => !it.auto && toggle(it.key)} disabled={it.auto} aria-pressed={it.done}>
                <span className="check">{it.done ? '✓' : ''}</span>
                <span className="check-text">
                  <span>{it.label}</span>
                  {it.sub && <small>{it.sub}{it.auto ? ' · automatikus' : ''}</small>}
                </span>
              </button>
              {it.kind === 'cindy' && (
                <Stepper label="Körök" value={rec.cindyRounds ?? 0} onChange={(v) => set({ cindyRounds: v, done: { ...rec.done, cindy: v > 0 || rec.done.cindy } })} />
              )}
              {it.kind === 'calls' && (
                <div className="calls">
                  <Stepper label="Hívás" value={rec.calls ?? 0} onChange={(v) => set({ calls: v })} />
                  <Stepper label="Elért" value={rec.reached ?? 0} onChange={(v) => set({ reached: v })} />
                  <Stepper label="Meeting" value={rec.meetings ?? 0} onChange={(v) => set({ meetings: v })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
