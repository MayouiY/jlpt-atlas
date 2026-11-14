import { useMemo, useState } from 'react';
import { BarCell, Card, KpLink, Seg } from '../components/ui';
import { TrendLines } from '../components/charts';
import { backtestRows, backtestSummary, getMeta, predictions, type PredictionRow } from '../lib/queries';
import { GROUP_NAMES, examDate, gapYears, num, pct, sessionLabel } from '../lib/format';

interface Reasons {
  f?: number[];
  sessions?: number;
  total?: number;
  sinceLast?: number | null;
  meanGap?: number | null;
  recent?: number[];
}

function PresenceTable({ rows, level }: { rows: PredictionRow[]; level: string }) {
  const max = rows[0]?.score ?? 1;
  if (!rows.length) return <div className="empty">暂无</div>;
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>考点</th>
            <th>出现概率</th>
            <th>历史</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const why = JSON.parse(r.reasons) as Reasons;
            return (
              <tr key={r.kp_id}>
                <td className="muted">{r.rank}</td>
                <td>
                  <KpLink id={r.kp_id} label={r.label} />
                  {r.reading && r.reading !== r.label && <span className="small muted jp"> {r.reading}</span>}
                  {r.meaning_zh && <div className="small muted">{r.meaning_zh}</div>}
                </td>
                <td>
                  <BarCell value={r.score} max={max} level={level} label={pct(r.score, 0)} />
                </td>
                <td className="small secondary">
                  {why.sessions ?? 0}/{why.total} 场
                  {why.sinceLast !== null && why.sinceLast !== undefined ? ` · 距上次 ${why.sinceLast} 场` : ' · 从未考查'}
                  {why.meanGap ? ` · 平均每 ${gapYears(why.meanGap)}` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CountTable({ rows, level }: { rows: PredictionRow[]; level: string }) {
  const max = rows[0]?.expected ?? 1;
  if (!rows.length) return <div className="empty">暂无</div>;
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead>
          <tr>
            <th>类型</th>
            <th>预计题数</th>
            <th className="num">近 4 场</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const why = JSON.parse(r.reasons) as Reasons;
            return (
              <tr key={r.kp_id}>
                <td>
                  <KpLink id={r.kp_id} label={r.label} />
                </td>
                <td>
                  <BarCell value={r.expected ?? 0} max={max} level={level} label={num(r.expected, 1)} />
                </td>
                <td className="num small">{(why.recent ?? []).join(' · ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Predict() {
  const meta = useMemo(getMeta, []);
  const [level, setLevel] = useState<'N1' | 'N2'>('N1');
  const [btGroup, setBtGroup] = useState('grammar');
  const [k, setK] = useState(20);
  const grammar = useMemo(() => predictions(level, 'grammar', 30), [level]);
  const kanji = useMemo(() => predictions(level, 'kanji', 15), [level]);
  const vocab = useMemo(() => predictions(level, 'vocab', 15), [level]);
  const wf = useMemo(() => predictions(level, 'word_formation', 10), [level]);
  const counts = useMemo(
    () => ['reading_skill', 'listening_skill', 'utterance_function', 'listening_scene', 'reading_feature', 'text_function'].map((g) => ({ g, rows: predictions(level, g, 14) })),
    [level],
  );
  const bt = useMemo(() => backtestRows(level, btGroup, k), [level, btGroup, k]);
  const summary = useMemo(() => backtestSummary(level), [level]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>下次考试重点预测</h1>
        <p>
          目标场次：<strong>{examDate(meta.next_session)}</strong>（{sessionLabel(meta.next_session)}）。语法、词汇、汉字、构词按“下次是否出现”建模：特征为平滑出现率、近期加权出现率、到期程度（距上次出现 ÷ 平均间隔）、上一场是否已考等，用逻辑回归在历年数据上拟合；题型类考点（阅读/听力的信息提取方式等）每场都会出现，给出近期加权的预计题数。
        </p>
      </header>

      <div className="controls">
        <Seg label="级别" value={level} onChange={setLevel} options={[{ value: 'N1', label: 'N1' }, { value: 'N2', label: 'N2' }]} />
        <span className="small muted">预测只反映历年统计规律，不代表官方出题意图；请结合下方回测结果判断可信度。</span>
      </div>

      <div className="grid-2">
        <Card title="语法句型 Top 30" sub="下次出现概率">
          <PresenceTable rows={grammar} level={level} />
        </Card>
        <div className="stack">
          <Card title="汉字 Top 15" sub="汉字读音/书写题中再次出现的概率">
            <PresenceTable rows={kanji} level={level} />
          </Card>
          <Card title="词汇 Top 15" sub="曾考查过的词再次出现的概率">
            <PresenceTable rows={vocab} level={level} />
          </Card>
          {wf.length > 0 && (
            <Card title="构词（词缀）Top 10">
              <PresenceTable rows={wf} level={level} />
            </Card>
          )}
        </div>
      </div>

      <div className="grid-3">
        {counts.map(({ g, rows }) => (
          <Card key={g} title={GROUP_NAMES[g]} sub="预计题数">
            <CountTable rows={rows} level={level} />
          </Card>
        ))}
      </div>

      <Card
        title="回测：预测到底准不准？"
        sub="对最近 10 场，只用该场之前的数据训练并预测，统计 Top-K 推荐中实际出现的比例"
        actions={
          <div className="row">
            <Seg label="考点种类" value={btGroup} onChange={setBtGroup} options={['grammar', 'kanji', 'vocab', 'word_formation'].map((g) => ({ value: g, label: GROUP_NAMES[g].replace(/（.*）/, '') }))} />
            <Seg label="K" value={String(k)} onChange={(v) => setK(Number(v))} options={[10, 20, 30, 50].map((x) => ({ value: String(x), label: `Top ${x}` }))} />
          </div>
        }
      >
        <TrendLines
          sessions={bt.map((r) => r.session_id)}
          series={[
            { name: '模型命中率', data: bt.map((r) => Math.round(r.precision * 100)) },
            { name: '按历史频次排序', data: bt.map((r) => Math.round(r.base_precision * 100)) },
            { name: '随机抽取（期望）', data: bt.map((r) => Math.round(r.random_precision * 100)) },
          ]}
          unit="%"
          ariaLabel="回测命中率：模型、频次基线与随机基线"
          height={220}
        />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>考点种类</th>
                <th className="num">K</th>
                <th className="num">模型命中率</th>
                <th className="num">频次基线</th>
                <th className="num">随机期望</th>
                <th className="num">模型召回率</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={`${s.grp}-${s.k}`}>
                  <td>{GROUP_NAMES[s.grp]}</td>
                  <td className="num">{s.k}</td>
                  <td className="num">{pct(s.p, 1)}</td>
                  <td className="num">{pct(s.bp, 1)}</td>
                  <td className="num">{pct(s.rp, 1)}</td>
                  <td className="num">{pct(s.r, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          解读：命中率 = Top-K 推荐中当场实际考到的比例；召回率 = 当场实际考到的考点中被 Top-K 覆盖的比例。语法句型的命中率约为随机抽取的 3–5 倍，说明“高频、到期”的句型确实更可能再出现；词汇与汉字每场大多是新词，可预测性很低，复习时应以覆盖面为主。
        </p>
      </Card>
    </div>
  );
}
