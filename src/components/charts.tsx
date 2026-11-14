import { useState } from 'react';
import { Chart, baseOption, type Tokens } from './Chart';
import { ViewToggle } from './ui';
import { sessionLabel } from '../lib/format';

export function SeriesLegend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label} className="legend-item">
          <span className={it.line ? 'swatch-line' : 'swatch'} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

const LEVEL_LEGEND = [
  { label: 'N1', color: 'var(--series-1)' },
  { label: 'N2', color: 'var(--series-2)' },
];

/** N1/N2 分组横向条形图（含表格视图） */
export function GroupedBars({ rows, unit, ariaLabel, onPick }: { rows: { id?: string; label: string; n1: number; n2: number }[]; unit: string; ariaLabel: string; onPick?: (id: string) => void }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const height = rows.length * 34 + 36;
  return (
    <div className="stack">
      <div className="row">
        <SeriesLegend items={LEVEL_LEGEND} />
        <span className="spacer" />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {view === 'chart' ? (
        <Chart
          height={height}
          ariaLabel={ariaLabel}
          deps={[rows]}
          onClick={onPick ? (p) => {
            const idx = (p as { dataIndex: number }).dataIndex;
            const id = rows[idx]?.id;
            if (id) onPick(id);
          } : undefined}
          option={(t: Tokens) => {
            const b = baseOption(t);
            return {
              ...b,
              grid: { left: 8, right: 24, top: 4, bottom: 24, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
              tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } }, valueFormatter: (v: number) => `${v} ${unit}` },
              xAxis: { type: 'value', ...b.axisCommon, axisLine: { show: false } },
              yAxis: {
                type: 'category',
                inverse: true,
                data: rows.map((r) => r.label),
                ...b.axisCommon,
                axisLabel: { color: t.text2, fontSize: 12, width: 190, overflow: 'truncate' },
                splitLine: { show: false },
              },
              series: [
                { name: 'N1', type: 'bar', data: rows.map((r) => r.n1), barWidth: 9, barGap: '25%', itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] }, cursor: onPick ? 'pointer' : 'default' },
                { name: 'N2', type: 'bar', data: rows.map((r) => r.n2), barWidth: 9, itemStyle: { color: t.series[1], borderRadius: [0, 4, 4, 0] }, cursor: onPick ? 'pointer' : 'default' },
              ],
            };
          }}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>类别</th>
                <th className="num">N1（{unit}）</th>
                <th className="num">N2（{unit}）</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{r.n1}</td>
                  <td className="num">{r.n2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 多条折线（≤4 条），x 轴为场次（含表格视图） */
export function TrendLines({ sessions, series, unit, ariaLabel, height = 240 }: { sessions: string[]; series: { name: string; data: (number | null)[] }[]; unit: string; ariaLabel: string; height?: number }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const colors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
  return (
    <div className="stack">
      <div className="row">
        {series.length > 1 && <SeriesLegend items={series.map((s, i) => ({ label: s.name, color: colors[i], line: true }))} />}
        <span className="spacer" />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {view === 'chart' ? (
        <Chart
          height={height}
          ariaLabel={ariaLabel}
          deps={[sessions, series]}
          option={(t: Tokens) => {
            const b = baseOption(t);
            return {
              ...b,
              grid: { left: 8, right: 16, top: 12, bottom: 8, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
              tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.baseline } }, valueFormatter: (v: number) => (v === null || v === undefined ? '-' : `${v} ${unit}`) },
              xAxis: { type: 'category', data: sessions.map(sessionLabel), boundaryGap: false, ...b.axisCommon, splitLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: 'auto' } },
              yAxis: { type: 'value', ...b.axisCommon, axisLine: { show: false }, minInterval: 1 },
              series: series.map((s, i) => ({
                name: s.name,
                type: 'line',
                data: s.data,
                connectNulls: false,
                symbol: 'circle',
                symbolSize: 8,
                showSymbol: false,
                lineStyle: { width: 2, color: t.series[i] },
                itemStyle: { color: t.series[i], borderColor: t.surface, borderWidth: 2 },
                emphasis: { focus: 'none', scale: false },
              })),
            };
          }}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>场次</th>
                {series.map((s) => (
                  <th key={s.name} className="num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((sid, i) => (
                <tr key={sid}>
                  <td>{sessionLabel(sid)}</td>
                  {series.map((s) => (
                    <td key={s.name} className="num">
                      {s.data[i] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
