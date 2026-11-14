import type { SessionRow, KpSessionRow } from '../lib/queries';
import { sessionLabel } from '../lib/format';

interface Props {
  sessions: SessionRow[]; // 全部场次（含取消/待举行）
  rows: { level: string; data: KpSessionRow[] }[];
  compact?: boolean;
  width?: number;
}

const COLORS: Record<string, string> = { N1: 'var(--series-1)', N2: 'var(--series-2)' };

/**
 * 考点出现时间轴：每列一场考试。实心点 = 被考查（大小随次数），空心环 = 仅作干扰项。
 * compact 模式用于表格行内（无坐标文字）。
 */
export function Timeline({ sessions, rows, compact = false, width }: Props) {
  const n = sessions.length;
  const step = compact ? 6 : 22;
  const labelW = compact ? 0 : 34;
  const rowH = compact ? 12 : 30;
  const top = compact ? 0 : 6;
  const axisH = compact ? 0 : 22;
  const w = labelW + n * step + (compact ? 0 : 8);
  const h = top + rows.length * rowH + axisH;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={width ?? (compact ? w : '100%')}
      height={compact ? h : undefined}
      style={compact ? undefined : { maxWidth: w * 1.4 }}
      role="img"
      aria-label="考点在各场考试中的出现情况"
    >
      {rows.map((r, ri) => {
        const y = top + ri * rowH + rowH / 2;
        const byId = new Map(r.data.map((d) => [d.session_id, d]));
        return (
          <g key={r.level}>
            {!compact && (
              <text x={0} y={y + 4} fontSize={12} fill="var(--text-secondary)">
                {r.level}
              </text>
            )}
            <line x1={labelW} x2={labelW + n * step} y1={y} y2={y} stroke="var(--grid)" strokeWidth={1} />
            {sessions.map((s, i) => {
              const cx = labelW + i * step + step / 2;
              const d = byId.get(s.id);
              const title = `${r.level} ${sessionLabel(s.id)}`;
              if (s.status === 'cancelled')
                return (
                  <g key={s.id}>
                    <title>{`${sessionLabel(s.id)}：考试取消`}</title>
                    <line x1={cx - 2} x2={cx + 2} y1={y - 2} y2={y + 2} stroke="var(--axis-muted)" strokeWidth={1} />
                    <line x1={cx - 2} x2={cx + 2} y1={y + 2} y2={y - 2} stroke="var(--axis-muted)" strokeWidth={1} />
                  </g>
                );
              if (s.status === 'upcoming')
                return (
                  <g key={s.id}>
                    <title>{`${sessionLabel(s.id)}：下次考试`}</title>
                    <rect x={cx - 3} y={y - 3} width={6} height={6} rx={1.5} fill="none" stroke="var(--axis-muted)" strokeWidth={1} />
                  </g>
                );
              if (!d) return null;
              const color = COLORS[r.level] ?? 'var(--series-1)';
              if (d.tested > 0) {
                const rad = compact ? 2.6 : d.tested > 1 ? 6 : 4.5;
                return (
                  <g key={s.id}>
                    <title>{`${title}：考查 ${d.tested} 次${d.distractor ? `，干扰项 ${d.distractor} 次` : ''}`}</title>
                    <circle cx={cx} cy={y} r={rad + 2} fill="var(--surface-1)" />
                    <circle cx={cx} cy={y} r={rad} fill={color} />
                  </g>
                );
              }
              return (
                <g key={s.id}>
                  <title>{`${title}：作为干扰项出现 ${d.distractor} 次`}</title>
                  <circle cx={cx} cy={y} r={compact ? 2.2 : 4} fill="var(--surface-1)" stroke={color} strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })}
      {!compact &&
        sessions.map((s, i) =>
          s.month === 7 && s.year % 2 === 0 ? (
            <text key={s.id} x={labelW + i * step + step / 2} y={h - 4} fontSize={11} textAnchor="middle" fill="var(--axis-muted)">
              {s.year}
            </text>
          ) : null,
        )}
    </svg>
  );
}

export function TimelineLegend() {
  return (
    <div className="legend">
      <span className="legend-item">
        <svg width="12" height="12">
          <circle cx="6" cy="6" r="4.5" fill="var(--series-1)" />
        </svg>
        N1 考查
      </span>
      <span className="legend-item">
        <svg width="12" height="12">
          <circle cx="6" cy="6" r="4.5" fill="var(--series-2)" />
        </svg>
        N2 考查
      </span>
      <span className="legend-item">
        <svg width="12" height="12">
          <circle cx="6" cy="6" r="4" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" />
        </svg>
        仅作干扰项
      </span>
      <span className="legend-item">
        <svg width="12" height="12">
          <line x1="3" x2="9" y1="3" y2="9" stroke="var(--axis-muted)" />
          <line x1="3" x2="9" y1="9" y2="3" stroke="var(--axis-muted)" />
        </svg>
        2020年7月考试取消
      </span>
      <span className="legend-item">
        <svg width="12" height="12">
          <rect x="3" y="3" width="6" height="6" rx="1.5" fill="none" stroke="var(--axis-muted)" />
        </svg>
        下次考试
      </span>
    </div>
  );
}
