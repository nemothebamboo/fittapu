import type { ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Bezárás">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, label, unit }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; label: string; unit?: string;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button className="step-btn" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label={`${label} csökkentése`}>−</button>
      <span className="stepper-val">{value.toLocaleString('hu-HU')}{unit ? ` ${unit}` : ''}</span>
      <button className="step-btn plus" onClick={() => onChange(+(value + step).toFixed(2))} aria-label={`${label} növelése`}>+</button>
    </div>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      {(title || right) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function NavHeader({ label, sub, onPrev, onNext, onToday }: { label: string; sub?: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="nav-header">
      <button className="icon-btn" onClick={onPrev} aria-label="Előző">‹</button>
      <button className="nav-title" onClick={onToday}>
        <strong>{label}</strong>
        {sub && <small>{sub}</small>}
      </button>
      <button className="icon-btn" onClick={onNext} aria-label="Következő">›</button>
    </div>
  );
}

const paths: Record<string, string> = {
  today: 'M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z',
  week: 'M4 6h16M4 6v13h16V6M8 3v4M16 3v4M4 10h16',
  progress: 'M4 19h16M6 16l4-5 3 3 5-7',
  report: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
};
export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function NumInput({ value, onChange, placeholder, step, decimal }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; step?: number; decimal?: boolean }) {
  return (
    <input
      className="num-input"
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      step={step}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        onChange(v === '' ? undefined : Number(v));
      }}
    />
  );
}
