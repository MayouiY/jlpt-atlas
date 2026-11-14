import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart, baseOption, type Tokens } from '../components/Chart';
import { Card, KpLink, Seg, ViewToggle } from '../components/ui';
import { cycleHistogram, heatmapKps, heldSessions, kpSessions, searchKps } from '../lib/queries';
import { gapYears, kpHref, sessionLabel } from '../lib/format';

const KIND_OPTIONS = [
  { value: 'grammar', label: '语法' },
  { value: 'vocab', label: '词汇' },
  { value: 'kanji', label: '汉字' },
  { value: 'word_formation', label: '构词' },
];

export function Recurrence() {
  const nav = useNavigate();
  const [level, setLevel] = useState<'N1' | 'N2'>('N1');
  const [kind, setKind] = useState('grammar');
  const [minSessions, setMinSessions] = useState(3);
  const [topN, setTopN] = useState(40);
  const [sort, setSort] = useState<'sessions' | 'recent'>('sessions');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const held = useMemo(heldSessions, []);
  const ids = held.map((s) => s.id);
  const kps = useMemo(() => heatmapKps(level, kind, minSessions, topN, sort), [level, kind, minSessions, topN, sort]);
  const occ = useMemo(() => kpSessions(kps.map((k) => k.kp_id), level), [kps, level]);
  const cells = useMemo(() => {
    const idx = new Map(ids.map((id, i) => [id, i]));
    const rowIdx = new Map(kps.map((k, i) => [k.kp_id, i]));
    return occ.filter((o) => o.tested > 0).map((o) => [idx.get(o.session_id)!, rowIdx.get(o.kp_id)!, o.tested] as [number, number, number]);
  }, [occ, kps, ids]);

  const regular = useMemo(
    () => searchKps({ level, kind, pattern: 'regular', minSessions: 3, sort: 'sessions', limit: 200 }),
    [level, kind],
  );
  const dormant = useMemo(
    () => searchKps({ level, kind, minSessions: 3, sort: 'since', limit: 200 }).filter((r) => (r.since_last ?? 0) >= 6).slice(0, 30),
    [level, kind],
  );
  const hist = useMemo(() => cycleHistogram(level, kind), [level, kind]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>复现规律</h1>
        <p>
          以“场次”为时间单位（每年两场，间隔 2 场 ≈ 1 年）。“规律复现”指至少出现 3 场、且各次间隔的变异系数 ≤ 0.5 的考点；“按周期到期”表示距上次出现的场次已达到它的典型间隔。
        </p>
      </header>

      <div className="controls">
        <Seg label="级别" value={level} onChange={setLevel} options={[{ value: 'N1', label: 'N1' }, { value: 'N2', label: 'N2' }]} />
        <Seg label="考点种类" value={kind} onChange={setKind} options={KIND_OPTIONS} />
        <label>
          至少出现
          <input type="number" min={1} max={32} value={minSessions} onChange={(e) => setMinSessions(Math.max(1, Number(e.target.value)))} />场
        </label>
        <label>
          显示
          <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
            {[20, 40, 60, 100].map((n) => (
              <option key={n} value={n}>
                前 {n} 个
              </option>
            ))}
          </select>
        </label>
        <label>
          排序
          <select value={sort} onChange={(e) => setSort(e.target.value as 'sessions' | 'recent')}>
            <option value="sessions">出现场次</option>
            <option value="recent">最近出现</option>
          </select>
        </label>
      </div>

      <Card
        title="考点 × 场次 热力图"
        sub={`${level} · 每格为该场考查次数，点击行查看详情`}
        actions={<ViewToggle value={view} onChange={setView} />}
      >
        <div className="legend" style={{ marginBottom: 8 }}>
          {[1, 2, 3].map((v, i) => (
            <span key={v} className="legend-item">
              <span className="swatch" style={{ background: ['var(--seq-250)', 'var(--seq-400)', 'var(--seq-700)'][i] }} />
              {v === 3 ? '3 次及以上' : `${v} 次`}
            </span>
          ))}
        </div>
        {kps.length === 0 ? (
          <div className="empty">没有符合条件的考点</div>
        ) : view === 'chart' ? (
          <Chart
            height={kps.length * 22 + 70}
            ariaLabel={`${level} 考点在各场次的出现热力图`}
            deps={[cells, kps]}
            onClick={(p) => {
              const v = (p as { value?: [number, number, number] }).value;
              if (v) nav(kpHref(kps[v[1]].kp_id));
            }}
            option={(t: Tokens) => {
              const b = baseOption(t);
              return {
                ...b,
                grid: { left: 8, right: 12, top: 8, bottom: 8, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
                tooltip: {
                  ...b.tooltip,
                  trigger: 'item',
                  formatter: (p: { value: [number, number, number] }) => `${kps[p.value[1]].label}<br/>${sessionLabel(ids[p.value[0]])}：考查 ${p.value[2]} 次`,
                },
                xAxis: {
                  type: 'category',
                  data: ids.map((id) => (id.endsWith('-07') ? id.slice(2, 4) + '.7' : id.slice(2, 4) + '.12')),
                  ...b.axisCommon,
                  splitLine: { show: false },
                  axisLabel: { color: t.muted, fontSize: 10, interval: 1 },
                },
                yAxis: {
                  type: 'category',
                  inverse: true,
                  data: kps.map((k) => k.label),
                  ...b.axisCommon,
                  axisLabel: { color: t.text2, fontSize: 12, width: 170, overflow: 'truncate' },
                  splitLine: { show: true, lineStyle: { color: t.grid } },
                },
                visualMap: {
                  show: false,
                  type: 'piecewise',
                  dimension: 2,
                  pieces: [
                    { min: 1, max: 1, color: t.seq[1] },
                    { min: 2, max: 2, color: t.seq[2] },
                    { min: 3, color: t.seq[4] },
                  ],
                },
                series: [
                  {
                    type: 'heatmap',
                    data: cells,
                    itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
                    emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
                    cursor: 'pointer',
                  },
                ],
              };
            }}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>考点</th>
                  <th className="num">出现场次</th>
                  <th>出现的场次</th>
                </tr>
              </thead>
              <tbody>
                {kps.map((k) => (
                  <tr key={k.kp_id}>
                    <td>
                      <KpLink id={k.kp_id} label={k.label} />
                    </td>
                    <td className="num">{k.sessions}</td>
                    <td className="small secondary">{(JSON.parse(k.session_list) as string[]).map(sessionLabel).join('、')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid-2">
        <Card title="规律复现的考点" sub={`${regular.length} 个 · 典型周期 = 间隔中位数`}>
          {regular.length === 0 ? (
            <div className="empty">暂无</div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>考点</th>
                    <th className="num">场次</th>
                    <th className="num">典型周期</th>
                    <th>最近</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {regular.map((r) => {
                    const due = r.median_gap !== null && r.since_last !== null && r.since_last + 1 >= r.median_gap;
                    return (
                      <tr key={r.kp_id}>
                        <td>
                          <KpLink id={r.kp_id} label={r.label} />
                        </td>
                        <td className="num">{r.sessions}</td>
                        <td className="num">每 {gapYears(r.median_gap)}</td>
                        <td className="small">{r.last_session ? sessionLabel(r.last_session) : '-'}</td>
                        <td>{due ? <span className="badge warn">按周期到期</span> : <span className="small muted">已隔 {r.since_last} 场</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="曾多次出现、近 3 年未出现" sub="可能回归的“沉寂”考点">
          {dormant.length === 0 ? (
            <div className="empty">暂无</div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>考点</th>
                    <th className="num">场次</th>
                    <th>最近</th>
                    <th className="num">已隔</th>
                    <th className="num">平均间隔</th>
                  </tr>
                </thead>
                <tbody>
                  {dormant.map((r) => (
                    <tr key={r.kp_id}>
                      <td>
                        <KpLink id={r.kp_id} label={r.label} />
                      </td>
                      <td className="num">{r.sessions}</td>
                      <td className="small">{r.last_session ? sessionLabel(r.last_session) : '-'}</td>
                      <td className="num">{gapYears(r.since_last)}</td>
                      <td className="num">{gapYears(r.mean_gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="复现周期分布" sub={`出现 ≥3 场的${KIND_OPTIONS.find((k) => k.value === kind)?.label}考点，按间隔中位数统计`}>
        {hist.length === 0 ? (
          <div className="empty">暂无</div>
        ) : (
          <Chart
            height={220}
            ariaLabel="考点复现周期（间隔中位数）的分布"
            deps={[hist]}
            option={(t: Tokens) => {
              const b = baseOption(t);
              return {
                ...b,
                grid: { left: 8, right: 16, top: 16, bottom: 8, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
                tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } }, valueFormatter: (v: number) => `${v} 个考点` },
                xAxis: { type: 'category', data: hist.map((h) => `${h.gap / 2} 年`), ...b.axisCommon, splitLine: { show: false } },
                yAxis: { type: 'value', ...b.axisCommon, axisLine: { show: false }, minInterval: 1 },
                series: [{ type: 'bar', data: hist.map((h) => h.n), barMaxWidth: 24, itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: t.text2, fontSize: 11 } }],
              };
            }}
          />
        )}
      </Card>
    </div>
  );
}
