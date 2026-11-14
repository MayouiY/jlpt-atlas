import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, KpLink, LevelBadge } from '../components/ui';
import { Timeline, TimelineLegend } from '../components/Timeline';
import { getSessions, kpById, kpOccurrences, kpPredictions, kpSessions, kpStats, relatedGrammar, type OccurrenceRow } from '../lib/queries';
import { GROUP_NAMES, gapYears, kindName, mondaiName, num, patternName, pct, roleName, sessionLabel } from '../lib/format';

function sourceLink(o: OccurrenceRow) {
  if (o.source_id === 'mojitest' && o.moji_url) return { href: o.moji_url, label: 'MOJiTest' };
  if (o.source_id === 'jlptpracticetest' && o.jpt_url) return { href: o.jpt_url, label: 'JPT' };
  return null;
}

function answerText(o: OccurrenceRow): string {
  if (o.answer) return o.answer;
  if (o.target) return o.target;
  return '';
}

export function KpDetail() {
  const { id = '' } = useParams();
  const kp = useMemo(() => kpById(id), [id]);
  const stats = useMemo(() => kpStats(id), [id]);
  const sessions = useMemo(getSessions, []);
  const occ = useMemo(() => kpSessions([id]), [id]);
  const occurrences = useMemo(() => kpOccurrences(id), [id]);
  const preds = useMemo(() => kpPredictions(id), [id]);
  const related = useMemo(() => (kp?.kind === 'grammar' ? relatedGrammar(id) : []), [id, kp?.kind]);

  if (!kp) return <div className="empty">未找到考点 {id}</div>;
  const byLevel = (lv: string) => stats.find((s) => s.level === lv);
  const levels = ['N1', 'N2'].filter((lv) => byLevel(lv) && (byLevel(lv)!.sessions > 0 || byLevel(lv)!.distractor > 0));
  const shownLevels = levels.length ? levels : ['N1', 'N2'];

  return (
    <div className="page">
      <header className="kp-head">
        <div className="row small secondary">
          <Link to={`/explore?kind=${kp.kind}`}>{kindName(kp.kind)}</Link>
          {kp.category && <span>· {kp.category}</span>}
          {kp.level_hint && <span className="badge">教材级别 {kp.level_hint}</span>}
          {kp.pos && kp.pos !== kp.category && <span className="badge">{kp.pos}</span>}
        </div>
        <div className="kp-title jp">{kp.label}</div>
        {kp.reading && kp.reading !== kp.label && <div className="jp secondary">{kp.reading}</div>}
        {kp.meaning_zh && <p>{kp.meaning_zh}</p>}
        {kp.description && <p className="secondary">{kp.description}</p>}
      </header>

      <Card title="历年出现情况" actions={<TimelineLegend />}>
        <div className="timeline">
          <Timeline sessions={sessions} rows={shownLevels.map((lv) => ({ level: lv, data: occ.filter((o) => o.level === lv) }))} />
        </div>
      </Card>

      <div className="grid-2">
        {['N1', 'N2'].map((lv) => {
          const s = byLevel(lv);
          const p = preds.find((x) => x.level === lv);
          return (
            <Card key={lv} title={<><LevelBadge level={lv} /> 统计</>}>
              {!s || (s.sessions === 0 && s.distractor === 0) ? (
                <p className="muted">{lv} 尚未考查过该考点。</p>
              ) : (
                <dl className="facts">
                  <dt>出现场次</dt>
                  <dd>
                    {s.sessions} / 32 场（考查 {s.tested} 次{s.distractor ? `，作干扰项 ${s.distractor} 次` : ''}）
                  </dd>
                  <dt>首次 / 最近</dt>
                  <dd>
                    {s.first_session ? sessionLabel(s.first_session) : '-'} / {s.last_session ? sessionLabel(s.last_session) : '-'}
                    {s.since_last !== null && s.since_last > 0 ? `（已隔 ${s.since_last} 场）` : s.since_last === 0 ? '（上一场刚考）' : ''}
                  </dd>
                  <dt>复现间隔</dt>
                  <dd>
                    平均 {gapYears(s.mean_gap)}，中位 {gapYears(s.median_gap)}
                    {s.min_gap !== null ? `，最短 ${gapYears(s.min_gap)}、最长 ${gapYears(s.max_gap)}` : ''}
                  </dd>
                  <dt>规律</dt>
                  <dd>
                    {patternName(s.pattern)}
                    {s.gap_cv !== null ? `（间隔变异系数 ${num(s.gap_cv, 2)}）` : ''}
                  </dd>
                  {p && (
                    <>
                      <dt>下次预测</dt>
                      <dd>
                        {p.expected !== null ? `预计 ${num(p.expected, 1)} 题` : `出现概率 ${pct(p.score, 1)}`}，在{GROUP_NAMES[p.grp] ?? p.grp}中排第 {p.rank} 位
                      </dd>
                    </>
                  )}
                </dl>
              )}
            </Card>
          );
        })}
      </div>

      {related.length > 0 && (
        <Card title="同题出现的其他句型" sub="正确答案与干扰项之间的搭配">
          <div className="tag-list">
            {related.map((r) => (
              <span key={`${r.id}-${r.relation}`} className="badge">
                <KpLink id={r.id} label={r.label} /> <span className="muted">{r.relation} ×{r.n}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title={`出现明细（${occurrences.length}）`} sub="题干与篇章受著作权保护，本库不收录，可点击来源查看原题">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>场次</th>
                <th>级别</th>
                <th>大题</th>
                <th>题号</th>
                <th>角色</th>
                <th>考查词 / 正确答案</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {occurrences.map((o) => {
                const src = sourceLink(o);
                return (
                  <tr key={`${o.question_id}-${o.role}`}>
                    <td>
                      <Link to={`/sessions/${o.level}/${o.session_id}`}>{sessionLabel(o.session_id)}</Link>
                    </td>
                    <td>
                      <LevelBadge level={o.level} />
                    </td>
                    <td className="small">
                      {o.part === 'listening' ? '听力' : ''}问题{o.mondai_no} {mondaiName(o.mondai_type)}
                    </td>
                    <td className="small">{o.number}</td>
                    <td className="small secondary">{roleName(o.role)}</td>
                    <td className="jp">
                      {answerText(o)}
                      {o.alt_answer_index !== null && <span className="badge warn" title="两个数据来源给出的答案不一致，已采用 MOJiTest 的答案"> 答案存疑</span>}
                    </td>
                    <td className="small">
                      {src ? (
                        <a href={src.href} target="_blank" rel="noreferrer noopener">
                          {src.label} ↗
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
