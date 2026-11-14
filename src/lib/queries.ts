// 前端用到的全部查询（只读）。
import { all, one } from './db';
import type { Level } from './domain';

export interface SessionRow {
  id: string;
  year: number;
  month: number;
  label: string;
  status: 'held' | 'cancelled' | 'upcoming';
  seq: number | null;
}

export interface KpRow {
  id: string;
  kind: string;
  category: string | null;
  label: string;
  reading: string | null;
  level_hint: string | null;
  meaning_zh: string | null;
  description: string | null;
  pos: string | null;
}

export interface StatRow {
  kp_id: string;
  level: string;
  tested: number;
  sessions: number;
  distractor: number;
  first_session: string | null;
  last_session: string | null;
  session_list: string;
  mean_gap: number | null;
  median_gap: number | null;
  min_gap: number | null;
  max_gap: number | null;
  gap_cv: number | null;
  since_last: number | null;
  pattern: string;
}

export type KpWithStats = KpRow & StatRow;

export function getMeta(): Record<string, string> {
  return Object.fromEntries(all<{ key: string; value: string }>('SELECT key, value FROM meta').map((r) => [r.key, r.value]));
}

export function getSessions(): SessionRow[] {
  return all<SessionRow>('SELECT * FROM exam_session ORDER BY id');
}

export function heldSessions(): SessionRow[] {
  return all<SessionRow>("SELECT * FROM exam_session WHERE status = 'held' ORDER BY seq");
}

export function kindCounts(): { kind: string; n: number }[] {
  return all('SELECT kind, COUNT(*) AS n FROM knowledge_point GROUP BY kind ORDER BY n DESC');
}

export function testedKindCounts(level: string): { kind: string; n: number }[] {
  return all(
    `SELECT k.kind, COUNT(*) AS n FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id
     WHERE s.level = ? AND s.sessions > 0 GROUP BY k.kind`,
    [level],
  );
}

export interface KpFilter {
  q?: string;
  level?: string; // N1 | N2 | ALL
  kind?: string;
  category?: string;
  pattern?: string;
  minSessions?: number;
  sort?: 'sessions' | 'tested' | 'distractor' | 'last' | 'since' | 'gap' | 'label';
  limit?: number;
  offset?: number;
}

const SORTS: Record<NonNullable<KpFilter['sort']>, string> = {
  sessions: 's.sessions DESC, s.tested DESC, k.sort',
  tested: 's.tested DESC, s.sessions DESC, k.sort',
  distractor: 's.distractor DESC, s.sessions DESC',
  last: 's.last_session DESC NULLS LAST, s.sessions DESC',
  since: 's.since_last DESC NULLS LAST, s.sessions DESC',
  gap: 's.mean_gap DESC NULLS LAST, s.sessions DESC',
  label: 'k.label',
};

function filterSql(f: KpFilter): { where: string; params: (string | number)[] } {
  const where: string[] = ['s.level = ?'];
  const params: (string | number)[] = [f.level ?? 'ALL'];
  if (f.kind) {
    where.push('k.kind = ?');
    params.push(f.kind);
  }
  if (f.category) {
    where.push('k.category = ?');
    params.push(f.category);
  }
  if (f.pattern) {
    where.push('s.pattern = ?');
    params.push(f.pattern);
  }
  if (f.minSessions) {
    where.push('s.sessions >= ?');
    params.push(f.minSessions);
  }
  if (f.q?.trim()) {
    for (const term of f.q.trim().split(/\s+/)) {
      where.push('(k.search_text LIKE ? OR k.id LIKE ?)');
      params.push(`%${term}%`, `%${term}%`);
    }
  }
  return { where: where.join(' AND '), params };
}

export function searchKps(f: KpFilter): KpWithStats[] {
  const { where, params } = filterSql(f);
  return all<KpWithStats>(
    `SELECT k.*, s.* FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id
     WHERE ${where} ORDER BY ${SORTS[f.sort ?? 'sessions']} LIMIT ? OFFSET ?`,
    [...params, f.limit ?? 100, f.offset ?? 0],
  );
}

export function countKps(f: KpFilter): number {
  const { where, params } = filterSql(f);
  return one<{ n: number }>(`SELECT COUNT(*) AS n FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id WHERE ${where}`, params)?.n ?? 0;
}

export function categories(kind: string): { category: string; n: number }[] {
  return all('SELECT category, COUNT(*) AS n FROM knowledge_point WHERE kind = ? AND category IS NOT NULL GROUP BY category ORDER BY n DESC', [kind]);
}

export function kpById(id: string): KpRow | undefined {
  return one<KpRow>('SELECT * FROM knowledge_point WHERE id = ?', [id]);
}

export function kpStats(id: string): StatRow[] {
  return all<StatRow>("SELECT * FROM kp_stats WHERE kp_id = ? ORDER BY CASE level WHEN 'N1' THEN 1 WHEN 'N2' THEN 2 ELSE 3 END", [id]);
}

export interface KpSessionRow {
  kp_id: string;
  level: Level;
  session_id: string;
  tested: number;
  distractor: number;
}

export function kpSessions(ids: string[], level?: string): KpSessionRow[] {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return all<KpSessionRow>(
    `SELECT * FROM kp_session WHERE kp_id IN (${ph})${level && level !== 'ALL' ? ' AND level = ?' : ''}`,
    level && level !== 'ALL' ? [...ids, level] : ids,
  );
}

export interface OccurrenceRow {
  question_id: string;
  role: string;
  level: Level;
  session_id: string;
  part: string;
  mondai_no: number;
  mondai_type: string;
  number: string;
  target: string | null;
  answer: string | null;
  options: string | null;
  answer_index: number | null;
  alt_answer_index: number | null;
  source_id: string | null;
  jpt_url: string | null;
  moji_url: string | null;
}

export function kpOccurrences(id: string): OccurrenceRow[] {
  return all<OccurrenceRow>(
    `SELECT qk.question_id, qk.role, q.level, q.session_id, q.part, q.mondai_no, q.mondai_type, q.number, q.target, q.answer,
            q.options, q.answer_index, q.alt_answer_index, q.source_id, ss.jpt_url, ss.moji_url
     FROM question_kp qk JOIN question q ON q.id = qk.question_id
     LEFT JOIN session_source ss ON ss.level = q.level AND ss.session_id = q.session_id
     WHERE qk.kp_id = ? ORDER BY q.session_id DESC, q.level, q.part, q.mondai_no, q.seq`,
    [id],
  );
}

/** 与该考点出现在同一道题中的其他语法考点（正确答案 ↔ 干扰项） */
export function relatedGrammar(id: string): { id: string; label: string; relation: string; n: number }[] {
  return all(
    `SELECT k.id, k.label,
            CASE WHEN a.role IN ('answer','component') AND b.role = 'distractor' THEN '作干扰项'
                 WHEN a.role = 'distractor' AND b.role IN ('answer','component') THEN '作正确答案'
                 ELSE '同题出现' END AS relation,
            COUNT(*) AS n
     FROM question_kp a JOIN question_kp b ON a.question_id = b.question_id AND b.kp_id <> a.kp_id
     JOIN knowledge_point k ON k.id = b.kp_id
     WHERE a.kp_id = ? AND k.kind = 'grammar'
     GROUP BY k.id, relation ORDER BY n DESC, k.sort LIMIT 24`,
    [id],
  );
}

export interface PredictionRow {
  level: Level;
  target_session: string;
  kp_id: string;
  grp: string;
  score: number;
  rank: number;
  expected: number | null;
  reasons: string;
  label: string;
  kind: string;
  category: string | null;
  reading: string | null;
  meaning_zh: string | null;
}

export function predictions(level: string, grp: string, limit = 30): PredictionRow[] {
  return all<PredictionRow>(
    `SELECT p.*, k.label, k.kind, k.category, k.reading, k.meaning_zh FROM prediction p JOIN knowledge_point k ON k.id = p.kp_id
     WHERE p.level = ? AND p.grp = ? ORDER BY p.rank LIMIT ?`,
    [level, grp, limit],
  );
}

export function kpPredictions(id: string): PredictionRow[] {
  return all<PredictionRow>(
    `SELECT p.*, k.label, k.kind, k.category, k.reading, k.meaning_zh,
            (SELECT COUNT(*) FROM prediction p2 WHERE p2.level = p.level AND p2.grp = p.grp) AS total
     FROM prediction p JOIN knowledge_point k ON k.id = p.kp_id WHERE p.kp_id = ? ORDER BY p.level`,
    [id],
  );
}

export interface BacktestRow {
  level: Level;
  grp: string;
  session_id: string;
  k: number;
  hits: number;
  actual: number;
  candidates: number;
  precision: number;
  recall: number;
  base_precision: number;
  base_recall: number;
  random_precision: number;
}

export function backtestRows(level: string, grp: string, k: number): BacktestRow[] {
  return all<BacktestRow>('SELECT * FROM backtest WHERE level = ? AND grp = ? AND k = ? ORDER BY session_id', [level, grp, k]);
}

export function backtestSummary(level: string): { grp: string; k: number; p: number; bp: number; rp: number; r: number; br: number }[] {
  return all(
    `SELECT grp, k, AVG(precision) AS p, AVG(base_precision) AS bp, AVG(random_precision) AS rp, AVG(recall) AS r, AVG(base_recall) AS br
     FROM backtest WHERE level = ? GROUP BY grp, k ORDER BY grp, k`,
    [level],
  );
}

/** 各场试卷按科目汇总的题数（展示题量结构的变化） */
export function structureTrend(level: string): { session_id: string; paper: string; items: number }[] {
  return all(
    `SELECT ps.session_id, mt.paper, SUM(ps.items) AS items FROM paper_structure ps JOIN mondai_type mt ON mt.id = ps.mondai_type
     WHERE ps.level = ? GROUP BY ps.session_id, mt.paper ORDER BY ps.session_id`,
    [level],
  );
}

/** 某类考点在两个级别的考查次数分布 */
export function distribution(kind: string): { id: string; label: string; category: string | null; n1: number; n2: number }[] {
  return all(
    `SELECT k.id, k.label, k.category,
            COALESCE((SELECT tested FROM kp_stats WHERE kp_id = k.id AND level = 'N1'), 0) AS n1,
            COALESCE((SELECT tested FROM kp_stats WHERE kp_id = k.id AND level = 'N2'), 0) AS n2
     FROM knowledge_point k WHERE k.kind = ? ORDER BY (n1 + n2) DESC, k.sort`,
    [kind],
  );
}

export function vocabPosDistribution(): { pos: string; n1: number; n2: number }[] {
  return all(
    `SELECT k.pos,
            SUM(CASE WHEN s.level = 'N1' THEN s.tested ELSE 0 END) AS n1,
            SUM(CASE WHEN s.level = 'N2' THEN s.tested ELSE 0 END) AS n2
     FROM knowledge_point k JOIN kp_stats s ON s.kp_id = k.id
     WHERE k.kind = 'vocab' AND s.level IN ('N1','N2') GROUP BY k.pos ORDER BY (n1 + n2) DESC`,
  );
}

/** 某类考点在各场次的考查次数（用于趋势） */
export function kindTrend(kind: string, level: string): { kp_id: string; session_id: string; tested: number }[] {
  return all(
    `SELECT ks.kp_id, ks.session_id, ks.tested FROM kp_session ks JOIN knowledge_point k ON k.id = ks.kp_id
     WHERE k.kind = ? AND ks.level = ?`,
    [kind, level],
  );
}

export interface SessionSourceRow {
  level: Level;
  session_id: string;
  language_source: string | null;
  listening_source: string | null;
  jpt_url: string | null;
  moji_url: string | null;
  check_compared: number | null;
  check_agreed: number | null;
  questions: number;
}

export function sessionSources(): SessionSourceRow[] {
  return all<SessionSourceRow>(
    `SELECT ss.*, (SELECT COUNT(*) FROM question q WHERE q.level = ss.level AND q.session_id = ss.session_id) AS questions
     FROM session_source ss ORDER BY ss.session_id DESC, ss.level`,
  );
}

export interface QuestionRow {
  id: string;
  level: Level;
  session_id: string;
  part: string;
  mondai_no: number;
  mondai_type: string;
  number: string;
  seq: number;
  target: string | null;
  answer: string | null;
  answer_index: number | null;
  alt_answer_index: number | null;
  options: string | null;
  skill: string | null;
  scene: string | null;
  func: string | null;
  image: number;
  source_id: string | null;
}

export function sessionQuestions(level: string, session: string): QuestionRow[] {
  return all<QuestionRow>('SELECT * FROM question WHERE level = ? AND session_id = ? ORDER BY seq', [level, session]);
}

export function sessionQuestionKps(level: string, session: string): { question_id: string; kp_id: string; role: string; label: string; kind: string }[] {
  return all(
    `SELECT qk.question_id, qk.kp_id, qk.role, k.label, k.kind FROM question_kp qk JOIN question q ON q.id = qk.question_id
     JOIN knowledge_point k ON k.id = qk.kp_id WHERE q.level = ? AND q.session_id = ? ORDER BY k.sort`,
    [level, session],
  );
}

export function sessionStructure(level: string, session: string): { part: string; mondai_no: number; mondai_type: string; items: number }[] {
  return all('SELECT part, mondai_no, mondai_type, items FROM paper_structure WHERE level = ? AND session_id = ? ORDER BY part, mondai_no', [level, session]);
}

export function mondaiTypes(): { id: string; name_ja: string; name_zh: string; paper: string; aim_zh: string }[] {
  return all('SELECT * FROM mondai_type ORDER BY sort');
}

/** 热力图：某级别、某类考点中出现场次最多的 N 个 */
export function heatmapKps(level: string, kind: string, minSessions: number, limit: number, sort: 'sessions' | 'recent' = 'sessions'): KpWithStats[] {
  return all<KpWithStats>(
    `SELECT k.*, s.* FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id
     WHERE s.level = ? AND k.kind = ? AND s.sessions >= ?
     ORDER BY ${sort === 'recent' ? 's.last_session DESC, s.sessions DESC' : 's.sessions DESC, s.tested DESC'}, k.sort LIMIT ?`,
    [level, kind, minSessions, limit],
  );
}

export function cycleHistogram(level: string, kind: string): { gap: number; n: number }[] {
  return all(
    `SELECT CAST(ROUND(s.median_gap) AS INTEGER) AS gap, COUNT(*) AS n FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id
     WHERE s.level = ? AND k.kind = ? AND s.sessions >= 3 GROUP BY gap ORDER BY gap`,
    [level, kind],
  );
}
