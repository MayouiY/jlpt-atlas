import { Fragment, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, KpLink, LevelBadge } from '../components/ui';
import { getSessions, mondaiTypes, sessionQuestionKps, sessionQuestions, sessionSources, sessionStructure, type QuestionRow } from '../lib/queries';
import { SOURCE_NAMES, mondaiName, pct, sessionLabel } from '../lib/format';
import { MONDAI_BY_ID, type MondaiType } from '../lib/domain';

export function Sessions() {
  const sessions = useMemo(getSessions, []);
  const sources = useMemo(sessionSources, []);
  const cell = (level: string, id: string) => {
    const s = sources.find((x) => x.level === level && x.session_id === id);
    if (!s) return <span className="muted">-</span>;
    return (
      <div className="stack" style={{ gap: 2 }}>
        <Link to={`/sessions/${level}/${id}`}>
          {s.questions} 题 →
        </Link>
        <span className="small muted">
          {s.language_source ? SOURCE_NAMES[s.language_source] : '-'} / {s.listening_source ? SOURCE_NAMES[s.listening_source] : '-'}
          {s.check_compared ? ` · 核对 ${pct(s.check_agreed! / s.check_compared, 0)}` : ''}
        </span>
      </div>
    );
  };
  return (
    <div className="page">
      <header className="page-head">
        <h1>历年场次</h1>
        <p>每场考试的数据来源（言语知识・阅读 / 听力）与两个来源的答案交叉核对结果。点击查看该场每道题的考点。</p>
      </header>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>场次</th>
                <th>状态</th>
                <th>N1</th>
                <th>N2</th>
              </tr>
            </thead>
            <tbody>
              {[...sessions].reverse().map((s) => (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="small secondary">{s.status === 'held' ? `第 ${s.seq} 场` : s.status === 'cancelled' ? '考试取消' : '下次考试'}</td>
                  <td>{s.status === 'held' ? cell('N1', s.id) : '-'}</td>
                  <td>{s.status === 'held' ? cell('N2', s.id) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type QKp = { question_id: string; kp_id: string; role: string; label: string; kind: string };

function KpChips({ kps, roles }: { kps: QKp[]; roles?: string[] }) {
  const list = roles ? kps.filter((k) => roles.includes(k.role)) : kps;
  if (!list.length) return <span className="muted">-</span>;
  return (
    <div className="tag-list">
      {list.map((k) => (
        <span key={`${k.kp_id}-${k.role}`} className="badge">
          <KpLink id={k.kp_id} label={k.label} />
        </span>
      ))}
    </div>
  );
}

export function SessionDetail() {
  const { level = 'N1', session = '' } = useParams();
  const qs = useMemo(() => sessionQuestions(level, session), [level, session]);
  const kps = useMemo(() => sessionQuestionKps(level, session), [level, session]);
  const structure = useMemo(() => sessionStructure(level, session), [level, session]);
  const types = useMemo(mondaiTypes, []);
  const src = useMemo(() => sessionSources().find((s) => s.level === level && s.session_id === session), [level, session]);
  const kpOf = (qid: string) => kps.filter((k) => k.question_id === qid);
  const groups: { title: string; types: MondaiType[] }[] = [
    { title: '文字・词汇', types: ['kanji_reading', 'orthography', 'word_formation', 'context', 'paraphrase', 'usage'] },
    { title: '语法', types: ['grammar_form', 'sentence_composition', 'text_grammar'] },
    { title: '阅读', types: ['reading_short', 'reading_mid', 'reading_long', 'reading_integrated', 'reading_thematic', 'info_retrieval'] },
    { title: '听力', types: ['listen_task', 'listen_point', 'listen_summary', 'listen_quick', 'listen_integrated'] },
  ];
  const optionText = (q: QuestionRow) => {
    if (!q.options || q.answer_index === null) return q.answer ?? '';
    const opts = JSON.parse(q.options) as string[];
    return opts[q.answer_index] ?? '';
  };
  if (!qs.length) return <div className="empty">没有 {level} {sessionLabel(session)} 的数据</div>;
  return (
    <div className="page">
      <header className="page-head">
        <div className="row">
          <LevelBadge level={level} />
          <h1>{sessionLabel(session)}</h1>
        </div>
        <p>
          共 {qs.length} 题。言语知识・阅读来源：{src?.language_source ? SOURCE_NAMES[src.language_source] : '-'}；听力来源：{src?.listening_source ? SOURCE_NAMES[src.listening_source] : '-'}
          {src?.check_compared ? `；两来源答案核对 ${src.check_agreed}/${src.check_compared} 题一致` : ''}。
          {src?.moji_url && (
            <>
              {' '}
              <a href={src.moji_url} target="_blank" rel="noreferrer noopener">
                在 MOJiTest 查看原题 ↗
              </a>
            </>
          )}
          {src?.jpt_url && (
            <>
              {' '}
              <a href={src.jpt_url} target="_blank" rel="noreferrer noopener">
                在 JLPT Practice Test 查看 ↗
              </a>
            </>
          )}
        </p>
      </header>

      <Card title="试卷结构">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>部分</th>
                <th>大题</th>
                <th>题型</th>
                <th className="num">题数</th>
                <th>考查目标</th>
              </tr>
            </thead>
            <tbody>
              {structure.map((s) => (
                <tr key={`${s.part}-${s.mondai_no}`}>
                  <td className="small">{s.part === 'listening' ? '听力' : '言语知识・阅读'}</td>
                  <td>问题{s.mondai_no}</td>
                  <td>
                    {mondaiName(s.mondai_type)} <span className="small muted jp">{MONDAI_BY_ID[s.mondai_type as MondaiType]?.nameJa}</span>
                  </td>
                  <td className="num">{s.items}</td>
                  <td className="small secondary">{types.find((t) => t.id === s.mondai_type)?.aim_zh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {groups.map((g) => {
        const rows = qs.filter((q) => g.types.includes(q.mondai_type as MondaiType));
        if (!rows.length) return null;
        const isLang = g.title === '文字・词汇' || g.title === '语法';
        return (
          <Card key={g.title} title={g.title} sub={`${rows.length} 题`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>题号</th>
                    <th>题型</th>
                    {isLang && <th>考查词 / 正确答案</th>}
                    <th>考点</th>
                    {isLang && <th>干扰项中的考点</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q, i) => {
                    const prev = rows[i - 1];
                    const head = !prev || prev.mondai_no !== q.mondai_no;
                    const qk = kpOf(q.id);
                    return (
                      <Fragment key={q.id}>
                        {head && (
                          <tr>
                            <td colSpan={isLang ? 5 : 3} className="small muted" style={{ background: 'var(--surface-2)' }}>
                              问题{q.mondai_no} · {mondaiName(q.mondai_type)}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="small">{q.number}</td>
                          <td className="small secondary">{mondaiName(q.mondai_type)}</td>
                          {isLang && (
                            <td className="jp">
                              {q.target && <span>{q.target}</span>}
                              {q.target && optionText(q) && <span className="muted"> → </span>}
                              {optionText(q)}
                              {q.alt_answer_index !== null && <span className="badge warn"> 答案存疑</span>}
                            </td>
                          )}
                          <td>
                            <KpChips kps={qk} roles={['answer', 'target', 'component', 'feature', 'skill']} />
                          </td>
                          {isLang && (
                            <td>
                              <KpChips kps={qk} roles={['distractor']} />
                            </td>
                          )}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
