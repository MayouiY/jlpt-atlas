// 事实层 + 种子数据 → 单文件 SQLite 数据库 data/jlpt-atlas.db
// 用法：npx tsx scripts/build-db.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import {
  backtest,
  expectedCount,
  fitModelBefore,
  gapStats,
  scoreAt,
  type SeriesItem,
} from '../src/lib/analysis.ts';
import { LEVELS, MONDAI_TYPES, TESTED_ROLES, sessionLabel, type KpKind, type KpRole, type Level } from '../src/lib/domain.ts';
import {
  LISTENING_SCENES,
  LISTENING_SKILLS,
  READING_FEATURES,
  READING_SKILLS,
  TEXT_FUNCTIONS,
  UTTERANCE_FUNCTIONS,
  classifyTextFunction,
  kanjiReadingFeatures,
  type Taxon,
} from './lib/classify.ts';
import { loadGrammarDict, matchGrammar } from './lib/grammar.ts';
import { lemmatize, loadTokenizer, readingOf, vocabPos } from './lib/morph.ts';
import type { FactQuestion, FactSession } from './lib/types.ts';
import { SCHEMA_SQL } from './schema.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const DB_PATH = join(ROOT, 'data/jlpt-atlas.db');
const FIRST_YEAR = 2010;
const LAST_YEAR = 2026;
const CANCELLED = new Set(['2020-07']);
const UPCOMING = '2026-12';

// ───────────── 读取数据 ─────────────
const facts: FactSession[] = readdirSync(join(ROOT, 'data/facts'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'data/facts', f), 'utf8')) as FactSession);
const dict = loadGrammarDict(join(ROOT, 'data/seed/grammar.yaml'));
const tk = await loadTokenizer();

// ───────────── 场次目录 ─────────────
const factSessions = new Set(facts.map((f) => f.session));
interface SessionRow {
  id: string;
  year: number;
  month: number;
  status: 'held' | 'cancelled' | 'upcoming';
  seq: number | null;
}
const sessions: SessionRow[] = [];
for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
  for (const m of [7, 12]) {
    const id = `${y}-${String(m).padStart(2, '0')}`;
    const status = CANCELLED.has(id) ? 'cancelled' : id === UPCOMING ? 'upcoming' : 'held';
    if (status === 'held' && !factSessions.has(id)) throw new Error(`缺少场次数据：${id}`);
    sessions.push({ id, year: y, month: m, status, seq: null });
  }
}
let seq = 0;
for (const s of sessions) if (s.status === 'held') s.seq = ++seq;
const heldIds = sessions.filter((s) => s.status === 'held').map((s) => s.id);
const T = heldIds.length; // 已举行的场次数
const idxOf = new Map(heldIds.map((id, i) => [id, i]));
const dataCutoff = heldIds[heldIds.length - 1];

// ───────────── 考点 ─────────────
interface Kp {
  id: string;
  kind: KpKind | 'text_function';
  category: string | null;
  label: string;
  reading: string | null;
  levelHint: string | null;
  meaningZh: string | null;
  description: string | null;
  pos: string | null;
  sort: number;
}
const kps = new Map<string, Kp>();
function addKp(kp: Omit<Kp, 'sort'> & { sort?: number }): string {
  if (!kps.has(kp.id)) kps.set(kp.id, { sort: kps.size, ...kp });
  return kp.id;
}

dict.entries.forEach((e) =>
  addKp({ id: `g:${e.id}`, kind: 'grammar', category: e.categoryName, label: e.label, reading: null, levelHint: e.level, meaningZh: e.zh, description: null, pos: null }),
);
const taxa: [Taxon[], Kp['kind'], string | null][] = [
  [READING_SKILLS, 'reading_skill', '阅读'],
  [LISTENING_SKILLS, 'listening_skill', '听力'],
  [LISTENING_SCENES, 'listening_scene', '听力场景'],
  [UTTERANCE_FUNCTIONS, 'utterance_function', '即时应答'],
  [READING_FEATURES, 'reading_feature', '汉字读音'],
  [TEXT_FUNCTIONS, 'text_function', '文章语法'],
];
for (const [list, kind, cat] of taxa) for (const t of list) addKp({ id: t.id, kind, category: cat, label: t.label, reading: null, levelHint: null, meaningZh: null, description: t.desc || null, pos: null });

// 听力题型的细分类别（按大题）
const LISTEN_CAT: Record<string, string> = { task: '课题理解', point: '要点理解', sum: '概要理解', quick: '即时应答', int: '综合理解' };
for (const t of LISTENING_SKILLS) kps.get(t.id)!.category = LISTEN_CAT[t.id.split(':')[1].split('_')[0]] ?? '听力';

const vocabCache = new Map<string, string>();
function ensureVocab(word: string, readingHint?: string): string | null {
  const w = word.normalize('NFKC').replace(/[\s　]/g, '');
  if (!w) return null;
  const cached = vocabCache.get(w);
  if (cached) return cached;
  const lemma = lemmatize(tk, w);
  const id = `v:${lemma}`;
  if (!kps.has(id)) {
    const reading = (lemma === w && readingHint) || readingOf(tk, lemma) || null;
    addKp({ id, kind: 'vocab', category: vocabPos(tk, lemma), label: lemma, reading, levelHint: null, meaningZh: null, description: null, pos: vocabPos(tk, lemma) });
  } else if (readingHint && lemma === w && !kps.get(id)!.reading) kps.get(id)!.reading = readingHint;
  vocabCache.set(w, id);
  return id;
}
const HAN = /\p{Script=Han}/gu;
function kanjiOf(s: string | undefined): string[] {
  return [...new Set((s ?? '').match(HAN) ?? [])];
}
function ensureKanji(ch: string): string {
  return addKp({ id: `k:${ch}`, kind: 'kanji', category: '汉字', label: ch, reading: null, levelHint: null, meaningZh: null, description: null, pos: null });
}
const SUFFIXES = new Set('化,的,性,感,式,型,風,用,製,産,家,者,員,料,費,代,賃,金,率,力,界,観,論,制,法,状,中,際,側,外,内,上,下,済,向け,だらけ,気味,ぶり,っぽい,付き,込み,明け,沿い,離れ,漬け,抜き,切れ,外れ,立て,建て,立ち,掛け,連れ,交じり,視,線,街,先,元,口,色,順,層,手,所,場,屋,品,物,券,省,署,団,隊,党,派,系,流,難,不足,過多,感覚,付け,深い,強い,づらい,がち,たて,ごと,おき,ずみ,気,ぎみ,寄り,並み,別,圏,帯,期,後,前,間,来'.split(','));
const PREFIXES = new Set('非,不,無,未,反,再,超,準,副,半,諸,各,毎,全,総,真,新,旧,高,低,好,悪,異,多,少,最,第,前,元,現,今,来,明,翌,初,片,大,小,名,本,主,当,同,別,両,双,真っ,短,長,重,軽,原,正,誤,逆,純,素,生,初め,過,被,脱,抗,対,亜,仮,諸,故,真夜,薄,厚,高い,低い,復,再び,猛,激,急,難,易,要'.split(','));
function ensureAffix(a: string): string | null {
  const s = a.normalize('NFKC').replace(/[\s　〜~]/g, '');
  if (!s) return null;
  const isS = SUFFIXES.has(s);
  const isP = PREFIXES.has(s);
  const category = isS && isP ? '接头/接尾词' : isS ? '接尾词' : isP ? '接头词' : '构词成分';
  const label = isS && !isP ? `〜${s}` : isP && !isS ? `${s}〜` : s;
  return addKp({ id: `wf:${s}`, kind: 'word_formation', category, label, reading: null, levelHint: null, meaningZh: null, description: null, pos: null });
}

// ───────────── 题目 & 考点关联 ─────────────
interface QuestionRow {
  id: string;
  level: Level;
  session: string;
  part: string;
  mondaiNo: number;
  type: string;
  number: string;
  seq: number;
  target: string | null;
  answer: string | null;
  answerIndex: number | null;
  altAnswerIndex: number | null;
  options: string | null;
  skill: string | null;
  scene: string | null;
  func: string | null;
  image: number;
  source: string | null;
}
const questions: QuestionRow[] = [];
const links: [string, string, KpRole][] = [];

function link(qid: string, kpId: string | null, role: KpRole) {
  if (kpId) links.push([qid, kpId, role]);
}

function grammarIds(text: string | undefined, includeBasic = true): string[] {
  if (!text) return [];
  return matchGrammar(dict, text, includeBasic).map((h) => `g:${h.id}`);
}

function deriveLinks(qid: string, q: FactQuestion) {
  const opts = q.options ?? [];
  const ans = q.answerIndex !== null && q.answerIndex !== undefined ? opts[q.answerIndex] : undefined;
  const distractors = opts.filter((_, i) => i !== q.answerIndex);
  switch (q.type) {
    case 'kanji_reading': {
      if (!q.target) break;
      link(qid, ensureVocab(q.target, ans), 'target');
      if (ans) for (const f of kanjiReadingFeatures(q.target, ans, distractors)) link(qid, f, 'feature');
      for (const ch of kanjiOf(q.target)) link(qid, ensureKanji(ch), 'component');
      break;
    }
    case 'orthography': {
      if (!ans) break;
      link(qid, ensureVocab(ans, q.target), 'target');
      const own = new Set(kanjiOf(ans));
      for (const ch of own) link(qid, ensureKanji(ch), 'component');
      for (const ch of new Set(distractors.flatMap((d) => kanjiOf(d)))) if (!own.has(ch)) link(qid, ensureKanji(ch), 'distractor');
      break;
    }
    case 'word_formation': {
      if (ans) link(qid, ensureAffix(ans), 'answer');
      for (const d of distractors) link(qid, ensureAffix(d), 'distractor');
      break;
    }
    case 'context': {
      if (ans) link(qid, ensureVocab(ans), 'answer');
      for (const d of distractors) link(qid, ensureVocab(d), 'distractor');
      break;
    }
    case 'paraphrase':
    case 'usage': {
      if (q.target) link(qid, ensureVocab(q.target), 'target');
      break;
    }
    case 'grammar_form':
    case 'text_grammar': {
      const a = new Set(grammarIds(ans));
      for (const g of a) link(qid, g, 'answer');
      for (const g of new Set(distractors.flatMap((d) => grammarIds(d)))) if (!a.has(g)) link(qid, g, 'distractor');
      if (q.type === 'text_grammar' && ans) link(qid, classifyTextFunction(ans), 'skill');
      break;
    }
    case 'sentence_composition': {
      for (const g of q.grammarHits ?? []) link(qid, `g:${g}`, 'component');
      break;
    }
    default: {
      if (q.skill) link(qid, q.skill, 'skill');
      if (q.scene) link(qid, q.scene, 'feature');
      if (q.func) link(qid, q.func, 'skill');
      for (const g of q.grammarHits ?? []) link(qid, `g:${g}`, 'component');
    }
  }
}

const SHORT_OPTION_TYPES = new Set(['kanji_reading', 'orthography', 'word_formation', 'context', 'paraphrase', 'grammar_form', 'text_grammar']);
const sessionSources: unknown[][] = [];
const structures: unknown[][] = [];
for (const f of facts) {
  sessionSources.push([
    f.level, f.session, f.sources.language, f.sources.listening, f.sourceUrls.jlptpracticetest ?? null, f.sourceUrls.mojitest ?? null,
    f.answerCheck?.compared ?? null, f.answerCheck?.agreed ?? null,
  ]);
  for (const s of f.structure) structures.push([f.level, f.session, s.part, s.mondaiNo, s.type, s.items]);
  f.questions.forEach((q, i) => {
    const id = `${f.level}-${f.session}-${q.part === 'language' ? 'L' : 'H'}${q.mondaiNo}-${q.number}`;
    const opts = q.options ?? [];
    const answer =
      q.answerIndex !== null && SHORT_OPTION_TYPES.has(q.type) ? (opts[q.answerIndex] ?? null) : null;
    questions.push({
      id,
      level: f.level,
      session: f.session,
      part: q.part,
      mondaiNo: q.mondaiNo,
      type: q.type,
      number: q.number,
      seq: i + 1,
      target: q.target ?? null,
      answer,
      answerIndex: q.answerIndex,
      altAnswerIndex: q.altAnswerIndex ?? null,
      options: SHORT_OPTION_TYPES.has(q.type) && opts.length ? JSON.stringify(opts) : null,
      skill: q.skill ?? null,
      scene: q.scene ?? null,
      func: q.func ?? null,
      image: q.image ? 1 : 0,
      source: q.part === 'language' ? f.sources.language : f.sources.listening,
    });
    deriveLinks(id, q);
  });
}

// 去重（同一题同一考点同一角色只记一次）
const linkKey = new Set<string>();
const uniqLinks = links.filter(([q, k, r]) => {
  if (!kps.has(k)) throw new Error(`未定义的考点：${k}`);
  const key = `${q}|${k}|${r}`;
  if (linkKey.has(key)) return false;
  linkKey.add(key);
  return true;
});

// ───────────── 统计 ─────────────
const qById = new Map(questions.map((q) => [q.id, q]));
const testedSet = new Set<string>(TESTED_ROLES);
type Agg = { hits: number[]; distractor: number[]; firstAny: number };
const agg = new Map<string, Agg>(); // key: level|kp
function aggOf(level: string, kp: string): Agg {
  const key = `${level}|${kp}`;
  let a = agg.get(key);
  if (!a) {
    a = { hits: Array(T).fill(0), distractor: Array(T).fill(0), firstAny: Infinity };
    agg.set(key, a);
  }
  return a;
}
for (const [qid, kp, role] of uniqLinks) {
  const q = qById.get(qid)!;
  const i = idxOf.get(q.session)!;
  for (const lv of [q.level, 'ALL']) {
    const a = aggOf(lv, kp);
    if (testedSet.has(role)) a.hits[i]++;
    else a.distractor[i]++;
    a.firstAny = Math.min(a.firstAny, i);
  }
}

const statsRows: unknown[][] = [];
const kpSessionRows: unknown[][] = [];
for (const kp of kps.values()) {
  for (const lv of [...LEVELS, 'ALL']) {
    const a = agg.get(`${lv}|${kp.id}`);
    const hits = a?.hits ?? Array(T).fill(0);
    const g = gapStats(hits, T);
    const distractor = a ? a.distractor.reduce((x, y) => x + y, 0) : 0;
    if (!a && kp.kind !== 'grammar') continue; // 未出现的非语法考点不写统计
    statsRows.push([
      kp.id, lv, g.tested, g.sessions, distractor,
      g.first === null ? null : heldIds[g.first], g.last === null ? null : heldIds[g.last],
      JSON.stringify(g.appearances.map((i) => heldIds[i])),
      g.meanGap, g.medianGap, g.minGap, g.maxGap, g.gapCv, g.sinceLast, g.pattern,
    ]);
    if (a && lv !== 'ALL') {
      for (let i = 0; i < T; i++) if (a.hits[i] || a.distractor[i]) kpSessionRows.push([kp.id, lv, heldIds[i], a.hits[i], a.distractor[i]]);
    }
  }
}

// ───────────── 预测与回测 ─────────────
const PRESENCE_GROUPS: Record<string, Kp['kind'][]> = {
  grammar: ['grammar'],
  vocab: ['vocab'],
  kanji: ['kanji'],
  word_formation: ['word_formation'],
};
const COUNT_GROUPS: Record<string, Kp['kind'][]> = {
  reading_skill: ['reading_skill'],
  listening_skill: ['listening_skill'],
  listening_scene: ['listening_scene'],
  utterance_function: ['utterance_function'],
  reading_feature: ['reading_feature'],
  text_function: ['text_function'],
};
const STORE_TOP: Record<string, number> = { grammar: 1000, vocab: 300, kanji: 300, word_formation: 200 };
const predictionRows: unknown[][] = [];
const backtestRows: unknown[][] = [];
const modelRows: unknown[][] = [];
const BT_TARGETS = Array.from({ length: 10 }, (_, i) => T - 10 + i);
const KS = [10, 20, 30, 50];

for (const level of LEVELS) {
  for (const [grp, kinds] of Object.entries(PRESENCE_GROUPS)) {
    const items: SeriesItem[] = [];
    for (const kp of kps.values()) {
      if (!kinds.includes(kp.kind)) continue;
      const a = agg.get(`${level}|${kp.id}`);
      if (!a && kp.kind !== 'grammar') continue;
      items.push({ id: kp.id, hits: a?.hits ?? Array(T).fill(0), knownFrom: kp.kind === 'grammar' ? 0 : (a?.firstAny ?? Infinity) });
    }
    const model = fitModelBefore(items, T);
    const ranked = scoreAt(items, T, model).slice(0, STORE_TOP[grp]);
    ranked.forEach((r, i) => {
      const g = gapStats(items.find((it) => it.id === r.id)!.hits, T);
      predictionRows.push([
        level, UPCOMING, r.id, grp, r.score, i + 1, null,
        JSON.stringify({ f: r.features.map((v) => Math.round(v * 1000) / 1000), sessions: g.sessions, total: T, sinceLast: g.sinceLast, meanGap: g.meanGap }),
      ]);
    });
    if (model) modelRows.push([level, grp, JSON.stringify(model.w.map((w) => Math.round(w * 1000) / 1000)), model.b]);
    for (const r of backtest(items, BT_TARGETS, KS)) {
      backtestRows.push([level, grp, heldIds[r.t], r.k, r.hits, r.actual, r.candidates, r.precision, r.recall, r.basePrecision, r.baseRecall, r.randomPrecision]);
    }
  }
  for (const [grp, kinds] of Object.entries(COUNT_GROUPS)) {
    const list = [...kps.values()].filter((kp) => kinds.includes(kp.kind));
    const scored = list
      .map((kp) => {
        const a = agg.get(`${level}|${kp.id}`);
        const counts = a?.hits ?? Array(T).fill(0);
        return { id: kp.id, exp: expectedCount(counts, T), recent: counts.slice(-4) };
      })
      .filter((x) => x.exp > 0.01)
      .sort((x, y) => y.exp - x.exp);
    scored.forEach((x, i) =>
      predictionRows.push([level, UPCOMING, x.id, grp, x.exp, i + 1, x.exp, JSON.stringify({ recent: x.recent })]),
    );
  }
}

// ───────────── 写入数据库 ─────────────
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(SCHEMA_SQL);
db.run('BEGIN');
function insertAll(table: string, cols: string[], rows: unknown[][]) {
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
  for (const r of rows) stmt.run(r as (string | number | null)[]);
  stmt.free();
}

const now = new Date().toISOString();
insertAll('meta', ['key', 'value'], [
  ['schema_version', '1'],
  ['built_at', now],
  ['data_cutoff', dataCutoff],
  ['next_session', UPCOMING],
  ['held_sessions', String(T)],
  ['question_count', String(questions.length)],
  ['kp_count', String(kps.size)],
  ['answer_check', JSON.stringify(facts.reduce((acc, f) => ({ compared: acc.compared + (f.answerCheck?.compared ?? 0), agreed: acc.agreed + (f.answerCheck?.agreed ?? 0) }), { compared: 0, agreed: 0 }))],
  ['note', '题目原文、篇章、听力原文与整句选项受著作权保护，本库不收录；仅收录考点元数据与短形式（词语、读音、语法形式）。'],
]);
insertAll('source', ['id', 'name', 'url', 'kind', 'note'], [
  ['jlptpracticetest', 'JLPT Practice Test', 'https://www.jlptpracticetest.com', 'community', '社区整理的历年真题（言語知識・読解）；robots.txt 允许抓取，按 1.5 秒间隔访问。'],
  ['mojitest', 'MOJiTest 题库', 'https://test.mojidict.com', 'commercial', '用户本人的 PRO 账号在浏览器内读取；提供 2010-07 至 2026-07 全部场次的听力与答案。'],
  ['jlpt-official', '日本語能力試験 公式サイト', 'https://www.jlpt.jp', 'official', '题型构成、各大题考查目标（ねらい）与 2022 年 12 月起 N1 听力题量调整。'],
  ['jlpt-atlas', '本项目整理', null, 'derived', '语法词典、信息提取方式分类、读音干扰类型等规则均为本项目自行编写。'],
]);
insertAll('exam_session', ['id', 'year', 'month', 'label', 'status', 'seq'], sessions.map((s) => [s.id, s.year, s.month, sessionLabel(s.id), s.status, s.seq]));
insertAll('mondai_type', ['id', 'name_ja', 'name_zh', 'paper', 'aim_zh', 'sort'], MONDAI_TYPES.map((m, i) => [m.id, m.nameJa, m.nameZh, m.paper, m.aimZh, i + 1]));
insertAll('session_source', ['level', 'session_id', 'language_source', 'listening_source', 'jpt_url', 'moji_url', 'check_compared', 'check_agreed'], sessionSources);
insertAll('paper_structure', ['level', 'session_id', 'part', 'mondai_no', 'mondai_type', 'items'], structures);
insertAll('question', ['id', 'level', 'session_id', 'part', 'mondai_no', 'mondai_type', 'number', 'seq', 'target', 'answer', 'answer_index', 'alt_answer_index', 'options', 'skill', 'scene', 'func', 'image', 'source_id'],
  questions.map((q) => [q.id, q.level, q.session, q.part, q.mondaiNo, q.type, q.number, q.seq, q.target, q.answer, q.answerIndex, q.altAnswerIndex, q.options, q.skill, q.scene, q.func, q.image, q.source]));
insertAll('knowledge_point', ['id', 'kind', 'category', 'label', 'reading', 'level_hint', 'meaning_zh', 'description', 'pos', 'sort', 'search_text'],
  [...kps.values()].map((k) => [k.id, k.kind, k.category, k.label, k.reading, k.levelHint, k.meaningZh, k.description, k.pos, k.sort,
    [k.label, k.reading, k.meaningZh, k.category, k.id.replace(/^\w+:/, '')].filter(Boolean).join(' ')]));
insertAll('question_kp', ['question_id', 'kp_id', 'role'], uniqLinks);
insertAll('kp_stats', ['kp_id', 'level', 'tested', 'sessions', 'distractor', 'first_session', 'last_session', 'session_list', 'mean_gap', 'median_gap', 'min_gap', 'max_gap', 'gap_cv', 'since_last', 'pattern'], statsRows);
insertAll('kp_session', ['kp_id', 'level', 'session_id', 'tested', 'distractor'], kpSessionRows);
insertAll('prediction', ['level', 'target_session', 'kp_id', 'grp', 'score', 'rank', 'expected', 'reasons'], predictionRows);
insertAll('backtest', ['level', 'grp', 'session_id', 'k', 'hits', 'actual', 'candidates', 'precision', 'recall', 'base_precision', 'base_recall', 'random_precision'], backtestRows);
insertAll('model', ['level', 'grp', 'weights', 'bias'], modelRows);
db.run('COMMIT');
db.run('ANALYZE');
db.run('VACUUM');
const bytes = db.export();
writeFileSync(DB_PATH, Buffer.from(bytes));
db.close();

const kindCount = new Map<string, number>();
for (const k of kps.values()) kindCount.set(k.kind, (kindCount.get(k.kind) ?? 0) + 1);
console.log(`已写入 ${DB_PATH}（${(bytes.length / 1024 / 1024).toFixed(2)} MB）`);
console.log(`场次 ${T}（截至 ${dataCutoff}，下次 ${UPCOMING}）；题目 ${questions.length}；考点 ${kps.size}；关联 ${uniqLinks.length}`);
console.log('考点种类：', Object.fromEntries(kindCount));
