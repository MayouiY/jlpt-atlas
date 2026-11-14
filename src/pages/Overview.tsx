import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarCell, Card, KpLink, Seg, Tile } from '../components/ui';
import { GroupedBars, TrendLines } from '../components/charts';
import { Timeline } from '../components/Timeline';
import { distribution, getMeta, getSessions, heldSessions, kindCounts, kpSessions, searchKps, structureTrend, vocabPosDistribution } from '../lib/queries';
import { examDate, gapYears, kindName, kpHref, pct, sessionLabel } from '../lib/format';
import { PAPER_NAMES, type Paper } from '../lib/domain';

function TopGrammar({ level }: { level: 'N1' | 'N2' }) {
  const sessions = useMemo(getSessions, []);
  const rows = useMemo(() => searchKps({ level, kind: 'grammar', sort: 'sessions', limit: 12 }), [level]);
  const occ = useMemo(() => kpSessions(rows.map((r) => r.kp_id), level), [rows, level]);
  const max = rows[0]?.sessions ?? 1;
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>句型（下方为 2010 → 2026 出现情况）</th>
            <th>出现场次</th>
            <th className="num">平均间隔</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.kp_id}>
              <td className="muted">{i + 1}</td>
              <td className="kp-cell">
                <KpLink id={r.kp_id} label={r.label} />
                <div className="small muted">{r.meaning_zh}</div>
                <Timeline compact sessions={sessions} rows={[{ level, data: occ.filter((o) => o.kp_id === r.kp_id) }]} />
              </td>
              <td>
                <BarCell value={r.sessions} max={max} level={level} label={`${r.sessions} 场`} />
              </td>
              <td className="num">{gapYears(r.mean_gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Overview() {
  const nav = useNavigate();
  const meta = useMemo(getMeta, []);
  const held = useMemo(heldSessions, []);
  const kinds = useMemo(kindCounts, []);
  const check = JSON.parse(meta.answer_check ?? '{"compared":0,"agreed":0}') as { compared: number; agreed: number };
  const [trendLevel, setTrendLevel] = useState<'N1' | 'N2'>('N1');
  const readingDist = useMemo(() => distribution('reading_skill').filter((r) => r.n1 + r.n2 > 0), []);
  const listeningDist = useMemo(() => distribution('listening_skill').filter((r) => r.n1 + r.n2 > 0), []);
  const featureDist = useMemo(() => distribution('reading_feature'), []);
  const funcDist = useMemo(() => distribution('utterance_function').filter((r) => r.n1 + r.n2 > 0), []);
  const posDist = useMemo(() => vocabPosDistribution().map((r) => ({ label: r.pos, n1: r.n1, n2: r.n2 })), []);
  const trend = useMemo(() => {
    const rows = structureTrend(trendLevel);
    const ids = held.map((s) => s.id);
    const papers: Paper[] = ['vocab', 'grammar', 'reading', 'listening'];
    return {
      ids,
      series: papers.map((p) => ({ name: PAPER_NAMES[p], data: ids.map((id) => rows.find((r) => r.session_id === id && r.paper === p)?.items ?? null) })),
    };
  }, [held, trendLevel]);
  const kindN = (k: string) => kinds.find((x) => x.kind === k)?.n ?? 0;
  const totalKp = kinds.reduce((a, b) => a + b.n, 0);

  return (
    <div className="page">
      <header className="page-head">
        <h1>JLPT N1・N2 历年考点图谱</h1>
        <p>
          收录 {sessionLabel(held[0].id)} 至 {sessionLabel(meta.data_cutoff)} 共 {held.length} 场考试（2020 年 7 月考试取消）N1、N2 全部大题（含听力）的考点元数据：语法句型、词汇与汉字读音、构词、阅读与听力的信息提取方式等，并分析考点的出现频率、复现周期与下次考试的可能重点。
        </p>
      </header>

      <div className="tiles">
        <Tile label="收录场次" value={held.length} note={`${sessionLabel(held[0].id)} – ${sessionLabel(meta.data_cutoff)}`} />
        <Tile label="题目" value={Number(meta.question_count).toLocaleString('zh-CN')} note="N1・N2 言语知识、阅读、听力" />
        <Tile label="考点" value={totalKp.toLocaleString('zh-CN')} note={`语法 ${kindN('grammar')} · 词汇 ${kindN('vocab')} · 汉字 ${kindN('kanji')}`} />
        <Tile label="两来源答案一致率" value={pct(check.agreed / Math.max(1, check.compared), 1)} note={`${check.agreed.toLocaleString('zh-CN')} / ${check.compared.toLocaleString('zh-CN')} 题交叉核对`} />
      </div>

      <Card title="下次考试" sub="按历年规律给出的考点出现概率与题型分布">
        <div className="hero">
          <div>
            <div className="hero-number">{examDate(meta.next_session)}</div>
            <div className="secondary">第 {held.length + 1} 场新制考试（N1・N2）</div>
          </div>
          <span className="spacer" />
          <Link to="/predict" className="badge">
            查看重点预测 →
          </Link>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="N1 考查最多的语法句型" sub="按出现场次排序">
          <TopGrammar level="N1" />
        </Card>
        <Card title="N2 考查最多的语法句型" sub="按出现场次排序">
          <TopGrammar level="N2" />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="阅读：信息提取方式" sub="各类问法的累计题数">
          <GroupedBars rows={readingDist} unit="题" ariaLabel="阅读题按信息提取方式的题数分布" onPick={(id) => nav(kpHref(id))} />
        </Card>
        <Card title="听力：信息提取方式" sub="按大题与问法细分的累计题数">
          <GroupedBars rows={listeningDist} unit="题" ariaLabel="听力题按信息提取方式的题数分布" onPick={(id) => nav(kpHref(id))} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="汉字读音：考查特征与干扰类型" sub="汉字读音题中各干扰类型出现的题数">
          <GroupedBars rows={featureDist} unit="题" ariaLabel="汉字读音题干扰类型分布" onPick={(id) => nav(kpHref(id))} />
        </Card>
        <Card title="词汇：词性分布" sub="词汇题考查词按词性统计（次）">
          <GroupedBars rows={posDist} unit="次" ariaLabel="词汇考查词的词性分布" />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="即时应答：话语功能" sub="对方一句话的功能类型（题数）">
          <GroupedBars rows={funcDist} unit="题" ariaLabel="即时应答题的话语功能分布" onPick={(id) => nav(kpHref(id))} />
        </Card>
        <Card
          title="题量结构变化"
          sub="各科目每场题数"
          actions={<Seg label="级别" value={trendLevel} onChange={setTrendLevel} options={[{ value: 'N1', label: 'N1' }, { value: 'N2', label: 'N2' }]} />}
        >
          <TrendLines sessions={trend.ids} series={trend.series} unit="题" ariaLabel={`${trendLevel} 各科目每场题数变化`} />
          <p className="small muted" style={{ marginTop: 8 }}>
            N1 听力自 2022 年 12 月起由 35 题减为 30 题（官方公告）；数据中还可见 N1 文章语法、中篇阅读与 N2 构词等大题题数的调整。
          </p>
        </Card>
      </div>

      <p className="small muted">
        考点种类：{kinds.map((k) => `${kindName(k.kind)} ${k.n}`).join(' · ')}。
      </p>
    </div>
  );
}
