import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useData } from '../store';
import type { Block, BlockType } from '../types';
import { absBlocks, checkRules, mealsFor, TYPE_META, TYPE_ORDER, uid } from '../schedule';
import type { AbsBlock } from '../schedule';
import { addDays, DAY, DAY_NAMES, DAY_SHORT, durText, hm, iso, mondayISO, parseHM, parseISO, shiftWeek, WEEK, weekLabel } from '../dates';
import { Modal, NavHeader } from '../components/ui';

const HOUR_H = 30;
const SNAP = 15;

interface Seg {
  b: AbsBlock;
  day: number;
  top: number;
  bottom: number;
  isLast: boolean;
  idx: number;
  lane: number;
  lanes: number;
}

function segments(abs: AbsBlock[]): Seg[] {
  const segs: Seg[] = [];
  for (const b of abs) {
    const e = b.abs + b.dur;
    if (e <= 0 || b.abs >= WEEK) continue;
    let idx = 0;
    for (let d = Math.max(0, Math.floor(b.abs / DAY)); d < 7 && d * DAY < e; d++) {
      const top = Math.max(b.abs, d * DAY) - d * DAY;
      const bottom = Math.min(e, (d + 1) * DAY) - d * DAY;
      if (bottom > top) segs.push({ b, day: d, top, bottom, isLast: e <= (d + 1) * DAY, idx: idx++, lane: 0, lanes: 1 });
    }
  }
  // sávok az egymást átfedő normál blokkoknak
  for (let d = 0; d < 7; d++) {
    const col = segs.filter((s) => s.day === d && s.b.type !== 'sleep' && s.b.type !== 'fast').sort((a, b) => a.top - b.top);
    let group: Seg[] = [];
    let groupEnd = -1;
    const flush = () => {
      const laneEnds: number[] = [];
      for (const s of group) {
        let l = laneEnds.findIndex((x) => x <= s.top);
        if (l < 0) { l = laneEnds.length; laneEnds.push(0); }
        laneEnds[l] = s.bottom;
        s.lane = l;
      }
      for (const s of group) s.lanes = laneEnds.length;
    };
    for (const s of col) {
      if (s.top >= groupEnd && group.length) { flush(); group = []; }
      group.push(s);
      groupEnd = Math.max(groupEnd, s.bottom);
    }
    if (group.length) flush();
  }
  return segs;
}

interface Drag {
  id: string;
  mode: 'move' | 'resize';
  x: number;
  y: number;
  start: number;
  dur: number;
  active: boolean;
  touch: boolean;
  timer?: number;
}

export default function Week() {
  const { weekBlocks, saveWeek, resetWeek, saveTemplate, weeks } = useData();
  const [monday, setMonday] = useState(() => mondayISO(new Date()));
  const [editing, setEditing] = useState<Block | null>(null);
  const [preview, setPreview] = useState<{ id: string; start: number; dur: number } | null>(null);
  const [showWarn, setShowWarn] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const cols = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const blocks = weekBlocks(monday);
  const abs = useMemo(() => absBlocks(monday, weekBlocks), [monday, weekBlocks]);
  const shown = useMemo(
    () => abs.map((b) => (preview && b.cur && b.id === preview.id ? { ...b, abs: preview.start, start: preview.start, dur: preview.dur } : b)),
    [abs, preview],
  );
  const segs = useMemo(() => segments(shown.filter((b) => !b.skipped || b.cur)), [shown]);
  const warnings = useMemo(() => checkRules(abs), [abs]);
  const warnIds = new Set(warnings.flatMap((w) => w.ids));
  const custom = !!weeks[monday];
  const todayIso = iso(new Date());

  const commit = (list: Block[]) => saveWeek(monday, list);
  const updateBlock = (b: Block) => {
    const exists = blocks.some((x) => x.id === b.id);
    commit(exists ? blocks.map((x) => (x.id === b.id ? b : x)) : [...blocks, b]);
  };
  const skip = (id: string) => commit(blocks.map((x) => (x.id === id ? { ...x, skipped: true } : x)));

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 3 * HOUR_H;
  }, []);

  // húzás
  const colW = () => (cols.current ? cols.current.getBoundingClientRect().width / 7 : 50);
  const compute = (d: Drag, cx: number, cy: number) => {
    const dmin = Math.round(((cy - d.y) / HOUR_H) * 60 / SNAP) * SNAP;
    if (d.mode === 'resize') return { id: d.id, start: d.start, dur: Math.max(SNAP, d.dur + dmin) };
    const dday = Math.round((cx - d.x) / colW());
    const start = Math.min(WEEK - SNAP, Math.max(0, d.start + dmin + dday * DAY));
    return { id: d.id, start, dur: d.dur };
  };
  const finish = (tap: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    clearTimeout(d.timer);
    const p = previewRef.current;
    if (d.active && p) {
      const b = blocks.find((x) => x.id === p.id);
      if (b && (b.start !== p.start || b.dur !== p.dur)) updateBlock({ ...b, start: p.start, dur: p.dur });
    } else if (tap) {
      const b = blocks.find((x) => x.id === d.id);
      if (b) setEditing(b);
    }
    setPreview(null);
  };

  useEffect(() => {
    const tmove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d || !d.touch) return;
      const t = e.touches[0];
      if (!d.active) {
        if (Math.hypot(t.clientX - d.x, t.clientY - d.y) > 8) { clearTimeout(d.timer); drag.current = null; }
        return;
      }
      e.preventDefault();
      setPreview(compute(d, t.clientX, t.clientY));
    };
    const tend = () => drag.current?.touch && finish(true);
    const mmove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d || d.touch) return;
      if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.active = true;
      if (d.active) setPreview(compute(d, e.clientX, e.clientY));
    };
    const mup = () => drag.current && !drag.current.touch && finish(true);
    window.addEventListener('touchmove', tmove, { passive: false });
    window.addEventListener('touchend', tend);
    window.addEventListener('touchcancel', tend);
    window.addEventListener('mousemove', mmove);
    window.addEventListener('mouseup', mup);
    return () => {
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend', tend);
      window.removeEventListener('touchcancel', tend);
      window.removeEventListener('mousemove', mmove);
      window.removeEventListener('mouseup', mup);
    };
  });

  const begin = (s: Seg, cx: number, cy: number, el: HTMLElement, touch: boolean) => {
    if (!s.b.cur) return;
    const r = el.getBoundingClientRect();
    const mode = s.isLast && s.b.type !== 'fast' && s.b.type !== 'sleep' && r.height >= 28 && r.bottom - cy < 10 ? 'resize' : 'move';
    const d: Drag = { id: s.b.id, mode, x: cx, y: cy, start: s.b.start, dur: s.b.dur, active: false, touch };
    if (touch)
      d.timer = window.setTimeout(() => {
        if (drag.current !== d) return;
        d.active = true;
        setPreview({ id: d.id, start: d.start, dur: d.dur });
        navigator.vibrate?.(15);
      }, 280);
    drag.current = d;
  };

  const newBlock = (): Block => {
    const now = new Date();
    const di = mondayISO(now) === monday ? (now.getDay() + 6) % 7 : 0;
    return { id: uid(), type: 'call', title: TYPE_META.call.label, start: di * DAY + 15 * 60, dur: 150, target: 50 };
  };

  return (
    <div className="screen week-screen">
      <NavHeader
        label={weekLabel(monday)}
        sub={custom ? 'ennek a hétnek saját terve van' : 'alaphét szerint'}
        onPrev={() => setMonday(shiftWeek(monday, -1))}
        onNext={() => setMonday(shiftWeek(monday, 1))}
        onToday={() => setMonday(mondayISO(new Date()))}
      />

      {warnings.length > 0 && (
        <div className="warn-box">
          <button className="warn-head" onClick={() => setShowWarn(!showWarn)}>
            ⚠️ {warnings.length} figyelmeztetés {showWarn ? '▴' : '▾'}
          </button>
          {showWarn && (
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>
                  {w.msg}
                  {w.fix && <button className="link-btn" onClick={() => skip(w.fix!.skipId)}>{w.fix.label}</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="week-actions">
        <button className="btn primary" onClick={() => setEditing(newBlock())}>+ Új blokk</button>
        <button className="btn" onClick={() => confirm('Ez a hét legyen az alaphét minden új hétnek?') && saveTemplate(blocks.map((b) => ({ ...b, skipped: false })))}>Legyen alaphét</button>
        {custom && <button className="btn" onClick={() => confirm('Visszaállítod ezt a hetet az alapra?') && resetWeek(monday)}>Alapra</button>}
      </div>
      <p className="hint">Koppints egy blokkra a szerkesztéshez. Tartsd nyomva, majd húzd az áthelyezéshez, az alján húzva a hosszát állítod.</p>

      <div className="week-grid">
        <div className="day-heads">
          <div className="gutter" />
          {DAY_SHORT.map((d, i) => {
            const date = addDays(parseISO(monday), i);
            return (
              <div key={d} className={`day-head ${iso(date) === todayIso ? 'today' : ''}`}>
                <b>{d}</b>
                <small>{date.getDate()}</small>
              </div>
            );
          })}
        </div>
        <div className="week-scroll" ref={scroller}>
          <div className="week-body" style={{ height: 24 * HOUR_H }}>
            <div className="gutter">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="hour-label" style={{ top: h * HOUR_H }}>{h}</div>
              ))}
            </div>
            <div className="cols" ref={cols}>
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="hour-line" style={{ top: h * HOUR_H }} />)}
              {Array.from({ length: 7 }, (_, d) => (
                <div key={d} className="col" style={{ left: `${(d / 7) * 100}%`, width: `${100 / 7}%` }}>
                  {mealsFor(shown, d).map((m) => (
                    <div key={m.key} className="meal-mark" style={{ top: (m.time / 60) * HOUR_H }} title={`${hm(m.time)} ${m.label}`} />
                  ))}
                </div>
              ))}
              {segs.map((s) => {
                const bg = s.b.type === 'sleep' || s.b.type === 'fast';
                const w = 100 / 7;
                const lw = bg ? w : w / s.lanes;
                const style: React.CSSProperties = {
                  top: (s.top / 60) * HOUR_H,
                  height: Math.max(10, ((s.bottom - s.top) / 60) * HOUR_H - 1),
                  left: `calc(${s.day * w + (bg ? 0 : s.lane * lw)}% + 1px)`,
                  width: `calc(${lw}% - 2px)`,
                  ['--c' as string]: TYPE_META[s.b.type].color,
                };
                const cls = ['blk', `blk-${s.b.type}`, bg ? 'bg' : '', s.b.skipped ? 'skipped' : '', !s.b.cur ? 'other-week' : '', warnIds.has(s.b.id) && s.b.cur ? 'warn' : '', preview?.id === s.b.id ? 'dragging' : ''].join(' ');
                const showText = (s.bottom - s.top) >= 30;
                return (
                  <div
                    key={`${s.b.monday}-${s.b.id}-${s.idx}`}
                    className={cls}
                    style={style}
                    onTouchStart={(e) => begin(s, e.touches[0].clientX, e.touches[0].clientY, e.currentTarget, true)}
                    onMouseDown={(e) => { e.preventDefault(); begin(s, e.clientX, e.clientY, e.currentTarget, false); }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {showText && (
                      <>
                        <span className="blk-title">{s.b.type === 'fast' ? 'Böjt' : s.b.title}</span>
                        {!bg && <span className="blk-time">{hm(s.b.abs)}</span>}
                      </>
                    )}
                    {s.isLast && !bg && s.b.cur && <span className="resize-handle" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <BlockEditor
          block={editing}
          isNew={!blocks.some((b) => b.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(b) => { updateBlock(b); setEditing(null); }}
          onDelete={(id) => { commit(blocks.filter((b) => b.id !== id)); setEditing(null); }}
        />
      )}
    </div>
  );
}

function BlockEditor({ block, isNew, onClose, onSave, onDelete }: { block: Block; isNew: boolean; onClose: () => void; onSave: (b: Block) => void; onDelete: (id: string) => void }) {
  const [b, setB] = useState<Block>(block);
  const day = Math.floor(b.start / DAY);
  const tod = b.start - day * DAY;
  const set = (p: Partial<Block>) => setB((x) => ({ ...x, ...p }));
  const setType = (type: BlockType) => {
    const wasDefaultTitle = Object.values(TYPE_META).some((m) => m.label === b.title) || !b.title;
    set({ type, title: wasDefaultTitle ? TYPE_META[type].label : b.title, target: type === 'call' ? b.target ?? 50 : undefined });
  };
  const hours = Math.floor(b.dur / 60);
  const mins = b.dur % 60;
  return (
    <Modal title={isNew ? 'Új blokk' : 'Blokk szerkesztése'} onClose={onClose}>
      <div className="form">
        <label>Típus
          <select value={b.type} onChange={(e) => setType(e.target.value as BlockType)}>
            {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </label>
        <label>Megnevezés
          <input value={b.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className="row2">
          <label>Nap
            <select value={day} onChange={(e) => set({ start: Number(e.target.value) * DAY + tod })}>
              {DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          </label>
          <label>Kezdés
            <input type="time" step={900} value={hm(tod)} onChange={(e) => e.target.value && set({ start: day * DAY + parseHM(e.target.value) })} />
          </label>
        </div>
        <div className="row2">
          <label>Hossz (óra)
            <input type="number" inputMode="numeric" min={0} value={hours} onChange={(e) => set({ dur: Math.max(15, Number(e.target.value || 0) * 60 + mins) })} />
          </label>
          <label>Perc
            <input type="number" inputMode="numeric" min={0} max={59} step={5} value={mins} onChange={(e) => set({ dur: Math.max(15, hours * 60 + Math.min(59, Number(e.target.value || 0))) })} />
          </label>
        </div>
        <p className="muted">{hm(tod)}–{hm(tod + b.dur)} · {durText(b.dur)}{tod + b.dur > DAY ? ' (átnyúlik a következő napra)' : ''}</p>
        {b.type === 'call' && (
          <label>Cél hívásszám
            <input type="number" inputMode="numeric" value={b.target ?? ''} onChange={(e) => set({ target: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
        )}
        {!isNew && (
          <label className="switch">
            <input type="checkbox" checked={!!b.skipped} onChange={(e) => set({ skipped: e.target.checked })} />
            Kihagyva ezen a héten
          </label>
        )}
        <div className="form-actions">
          {!isNew && <button className="btn danger" onClick={() => confirm('Törlöd ezt a blokkot erről a hétről?') && onDelete(b.id)}>Törlés</button>}
          <button className="btn primary" onClick={() => onSave(b)}>Mentés</button>
        </div>
      </div>
    </Modal>
  );
}
