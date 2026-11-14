import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KpLink, Seg } from '../components/ui';
import { Timeline, TimelineLegend } from '../components/Timeline';
import { categories, countKps, getSessions, kpSessions, searchKps, type KpFilter } from '../lib/queries';
import { KIND_NAMES, gapYears, kindName, patternName, sessionLabel } from '../lib/format';
import { PATTERN_NAMES } from '../lib/analysis';

const PAGE = 60;
const SORT_OPTIONS: { value: NonNullable<KpFilter['sort']>; label: string }[] = [
  { value: 'sessions', label: '出现场次' },
  { value: 'tested', label: '考查次数' },
  { value: 'distractor', label: '作干扰项次数' },
  { value: 'last', label: '最近出现' },
  { value: 'since', label: '久未出现' },
  { value: 'gap', label: '平均间隔' },
  { value: 'label', label: '名称' },
];

export function Explore() {
  const [sp, setSp] = useSearchParams();
  const f: KpFilter = {
    q: sp.get('q') ?? '',
    level: sp.get('level') ?? 'ALL',
    kind: sp.get('kind') ?? '',
    category: sp.get('cat') ?? '',
    pattern: sp.get('pattern') ?? '',
    minSessions: Number(sp.get('min') ?? 1),
    sort: (sp.get('sort') as KpFilter['sort']) ?? 'sessions',
  };
  const page = Number(sp.get('page') ?? 0);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    if (k === 'kind') n.delete('cat');
    setSp(n, { replace: true });
  };
  const sessions = useMemo(getSessions, []);
  const total = useMemo(() => countKps(f), [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => searchKps({ ...f, limit: PAGE, offset: page * PAGE }), [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const occ = useMemo(() => kpSessions(rows.map((r) => r.kp_id)), [rows]);
  const cats = useMemo(() => (f.kind ? categories(f.kind) : []), [f.kind]);
  const levelRows = f.level === 'ALL' ? ['N1', 'N2'] : [f.level!];

  return (
    <div className="page">
      <header className="page-head">
        <h1>考点检索</h1>
        <p>按名称、读音、中文释义检索语法、词汇、汉字、读音特征、阅读/听力信息提取方式等考点，并按出现频率、复现间隔排序。点击考点查看历年出现明细。</p>
      </header>

      <div className="controls">
        <input type="search" placeholder="搜索：例如 ものの / 措置 / 理由 / 长音" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="搜索考点" />
        <Seg
          label="级别"
          value={f.level as string}
          onChange={(v) => set('level', v === 'ALL' ? '' : v)}
          options={[
            { value: 'ALL', label: 'N1+N2' },
            { value: 'N1', label: 'N1' },
            { value: 'N2', label: 'N2' },
          ]}
        />
        <label>
          种类
          <select value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="">全部</option>
            {Object.entries(KIND_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {cats.length > 1 && (
          <label>
            类别
            <select value={f.category} onChange={(e) => set('cat', e.target.value)}>
              <option value="">全部</option>
              {cats.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}（{c.n}）
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          规律
          <select value={f.pattern} onChange={(e) => set('pattern', e.target.value)}>
            <option value="">全部</option>
            {Object.entries(PATTERN_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          至少出现
          <input type="number" min={0} max={32} value={f.minSessions} onChange={(e) => set('min', e.target.value === '1' ? '' : e.target.value)} />场
        </label>
        <label>
          排序
          <select value={f.sort} onChange={(e) => set('sort', e.target.value === 'sessions' ? '' : e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{total.toLocaleString('zh-CN')} 个考点</h2>
          <TimelineLegend />
        </div>
        {rows.length === 0 ? (
          <div className="empty">没有符合条件的考点</div>
        ) : (
          <div className="table-wrap table-wide">
            <table>
              <thead>
                <tr>
                  <th>考点</th>
                  <th>种类 / 类别</th>
                  <th className="num">出现场次</th>
                  <th className="num">考查</th>
                  <th className="num">干扰项</th>
                  <th>最近</th>
                  <th className="num">平均间隔</th>
                  <th>规律</th>
                  <th>2010 → 2026</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kp_id}>
                    <td className="kp-cell">
                      <KpLink id={r.kp_id} label={r.label} />
                      {r.reading && r.reading !== r.label && <span className="small muted jp"> {r.reading}</span>}
                      {r.meaning_zh && <div className="small muted">{r.meaning_zh}</div>}
                    </td>
                    <td className="small secondary">
                      {kindName(r.kind)}
                      {r.category && r.category !== kindName(r.kind) ? ` · ${r.category}` : ''}
                    </td>
                    <td className="num">{r.sessions}</td>
                    <td className="num">{r.tested}</td>
                    <td className="num">{r.distractor}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{r.last_session ? sessionLabel(r.last_session) : '-'}</td>
                    <td className="num">{gapYears(r.mean_gap)}</td>
                    <td className="small secondary" style={{ whiteSpace: 'nowrap' }}>{patternName(r.pattern)}</td>
                    <td>
                      <Timeline compact sessions={sessions} rows={levelRows.map((lv) => ({ level: lv, data: occ.filter((o) => o.kp_id === r.kp_id && o.level === lv) }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE && (
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-link" disabled={page === 0} onClick={() => set('page', String(page - 1))}>
              ← 上一页
            </button>
            <span className="small muted">
              第 {page + 1} / {Math.ceil(total / PAGE)} 页
            </span>
            <button type="button" className="btn-link" disabled={(page + 1) * PAGE >= total} onClick={() => set('page', String(page + 1))}>
              下一页 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
