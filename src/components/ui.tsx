import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { kpHref } from '../lib/format';

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {note && <span className="tile-note">{note}</span>}
    </div>
  );
}

export function Card({ title, sub, actions, children }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {sub && <span className="card-sub">{sub}</span>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** 表格行内的比例条（数值同时以文字给出，不依赖颜色） */
export function BarCell({ value, max, label, level }: { value: number; max: number; label?: string; level?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="bar-cell">
      <div className="bar-track" aria-hidden="true">
        <div className={`bar-fill${level === 'N2' ? ' n2' : ''}`} style={{ width: `${w}%` }} />
      </div>
      <span className="bar-value">{label ?? value}</span>
    </div>
  );
}

export function KpLink({ id, label, className }: { id: string; label: string; className?: string }) {
  return (
    <Link to={kpHref(id)} className={`jp kp-label ${className ?? ''}`}>
      {label}
    </Link>
  );
}

export function LevelBadge({ level }: { level: string }) {
  return <span className={`badge ${level === 'N1' ? 'n1' : level === 'N2' ? 'n2' : ''}`}>{level}</span>;
}

/** 图表 / 表格 视图切换：每个图都有等价的表格 */
export function ViewToggle({ value, onChange }: { value: 'chart' | 'table'; onChange: (v: 'chart' | 'table') => void }) {
  return (
    <Seg
      label="视图"
      value={value}
      onChange={onChange}
      options={[
        { value: 'chart', label: '图表' },
        { value: 'table', label: '表格' },
      ]}
    />
  );
}
