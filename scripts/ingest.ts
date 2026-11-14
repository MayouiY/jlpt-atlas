// 原始缓存 → 事实层（data/facts/*.json）。
// 用法：npx tsx scripts/ingest.ts --jpt <jlptpracticetest 缓存目录> --moji <MOJiTest 提取 JSON>
// 事实层只保存短形式（词、读音、语法形式）与派生标签，不保存题干、篇章、听力原文、★题片段或整句选项。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Level } from '../src/lib/domain.ts';
import { classifyListening, classifyReadingStem, classifyScene, classifyUtterance } from './lib/classify.ts';
import { loadGrammarDict, matchGrammar } from './lib/grammar.ts';
import type { FactQuestion, FactSession, RawQuestion } from './lib/types.ts';
import { parseCacheFileName, parseSessionPage } from './sources/jlptpracticetest/parse.ts';
import { parseMojiText, type MojiSession } from './sources/mojitest/parse.ts';

const ROOT = new URL('..', import.meta.url).pathname;

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const jptDir = arg('jpt', join(ROOT, '.cache/jlptpracticetest'));
const mojiFile = arg('moji', join(ROOT, '.cache/mojitest/extract.json'));
const outDir = arg('out', join(ROOT, 'data/facts'));

const dict = loadGrammarDict(join(ROOT, 'data/seed/grammar.yaml'));
const overrides = JSON.parse(readFileSync(join(ROOT, 'data/seed/answer-overrides.json'), 'utf8')) as Record<string, string>;

// ── 读取 jlptpracticetest ──
const jpt = new Map<string, RawQuestion[]>();
if (existsSync(jptDir)) {
  for (const f of readdirSync(jptDir).sort()) {
    const meta = parseCacheFileName(f);
    if (!meta) continue;
    const url = `https://www.jlptpracticetest.com/n${meta.level[1]}/${meta.session.replace('-', '')}/${meta.section}`;
    const qs = parseSessionPage(readFileSync(join(jptDir, f), 'utf8'), meta.level, meta.session, url);
    const key = `${meta.level}|${meta.session}`;
    jpt.set(key, [...(jpt.get(key) ?? []), ...qs]);
  }
} else console.warn(`[ingest] 未找到 jlptpracticetest 缓存：${jptDir}`);

// ── 读取 MOJiTest ──
const moji = new Map<string, MojiSession>();
const warnings: string[] = [];
if (existsSync(mojiFile)) {
  const raw = JSON.parse(readFileSync(mojiFile, 'utf8')) as Record<string, string>;
  // 先放基础条目，再用 ':full' 条目覆盖
  const keys = Object.keys(raw).sort((a, b) => Number(a.includes(':full')) - Number(b.includes(':full')));
  for (const k of keys) {
    const s = parseMojiText(raw[k]);
    warnings.push(...s.warnings.map((w) => `[moji ${s.level} ${s.session}] ${w}`));
    moji.set(`${s.level}|${s.session}`, s);
  }
} else console.warn(`[ingest] 未找到 MOJiTest 提取文件：${mojiFile}`);

// jlptpracticetest 个别场次的阅读题题号录入错误（编号倒退），按大题顺序顺延修正
let renumbered = 0;
for (const qs of jpt.values()) {
  qs.sort((a, b) => a.mondaiNo - b.mondaiNo);
  let last = 0;
  for (const q of qs) {
    const n = Number(q.number);
    if (n <= last) {
      q.number = String(last + 1);
      renumbered++;
    }
    last = Number(q.number);
  }
}
if (renumbered) console.log(`[ingest] 修正 jlptpracticetest 倒退题号 ${renumbered} 处`);

const sessionKeys = [...new Set([...jpt.keys(), ...moji.keys()])].sort();

function toFact(q: RawQuestion): FactQuestion {
  const f: FactQuestion = { part: q.part, mondaiNo: q.mondaiNo, type: q.type, number: q.number, answerIndex: q.answerIndex };
  switch (q.type) {
    case 'kanji_reading':
    case 'orthography':
    case 'paraphrase':
      f.target = q.target;
      f.options = q.options;
      break;
    case 'usage':
      f.target = q.target;
      break;
    case 'word_formation':
    case 'context':
    case 'grammar_form':
    case 'text_grammar':
      f.options = q.options;
      break;
    case 'sentence_composition': {
      // ★题片段属于题干原文，只保存从中识别出的语法考点
      const hits = matchGrammar(dict, (q.options ?? []).join('／'), false).map((h) => h.id);
      if (hits.length) f.grammarHits = [...new Set(hits)];
      break;
    }
    case 'listen_task':
    case 'listen_point':
    case 'listen_summary':
    case 'listen_integrated':
      f.skill = classifyListening(q.type, q.listen?.question ?? '');
      f.scene = classifyScene(q.listen?.scene ?? '');
      if (q.listen?.image) f.image = true;
      break;
    case 'listen_quick': {
      f.skill = 'l:quick_response';
      const u = q.listen?.utterance ?? '';
      f.func = classifyUtterance(u);
      const hits = matchGrammar(dict, u, false).map((h) => h.id);
      if (hits.length) f.grammarHits = [...new Set(hits)];
      break;
    }
    default:
      f.skill = classifyReadingStem(q.type, q.stem ?? '');
  }
  return f;
}

mkdirSync(outDir, { recursive: true });
let totalQ = 0;
let compared = 0;
let agreed = 0;
const summary: string[] = [];
for (const key of sessionKeys) {
  const [level, session] = key.split('|') as [Level, string];
  const m = moji.get(key);
  const j = jpt.get(key);
  const useMojiLang = Boolean(m?.full);
  const lang = useMojiLang ? m!.questions.filter((q) => q.part === 'language') : (j ?? []);
  const listen = m ? m.questions.filter((q) => q.part === 'listening') : [];
  const fact: FactSession = {
    level,
    session,
    sources: { language: lang.length ? (useMojiLang ? 'mojitest' : 'jlptpracticetest') : null, listening: listen.length ? 'mojitest' : null },
    sourceUrls: {},
    structure: [],
    questions: [],
  };
  if (j?.length) fact.sourceUrls.jlptpracticetest = `https://www.jlptpracticetest.com/n${level[1]}/${session.replace('-', '')}`;
  if (m) fact.sourceUrls.mojitest = m.questions[0]?.sourceUrl;

  // 试卷结构：优先使用 MOJiTest（完整），否则由题目推断
  if (m?.structure.length) fact.structure = m.structure;
  else {
    const counts = new Map<string, { part: 'language'; mondaiNo: number; type: RawQuestion['type']; items: number }>();
    for (const q of lang) {
      const c = counts.get(String(q.mondaiNo)) ?? { part: 'language' as const, mondaiNo: q.mondaiNo, type: q.type, items: 0 };
      c.items++;
      counts.set(String(q.mondaiNo), c);
    }
    fact.structure = [...counts.values()].sort((a, b) => a.mondaiNo - b.mondaiNo);
  }

  // 答案交叉核对（jlptpracticetest 题目 vs MOJiTest 答案序列，按题号对齐）。
  // 不一致时默认采用 MOJiTest，另一答案记入 altAnswerIndex；answer-overrides.json 可指定例外。
  const alt = new Map<string, number>();
  if (!useMojiLang && m?.answerKey && j?.length) {
    const check = { compared: 0, agreed: 0, disagreed: [] as string[] };
    for (const q of j) {
      const n = Number(q.number);
      const k = m.answerKey[n - 1];
      if (k === undefined || q.answerIndex === null) continue;
      check.compared++;
      if (Number(k) === q.answerIndex) {
        check.agreed++;
        continue;
      }
      check.disagreed.push(q.number);
      const prefer = overrides[`${level}-${session}#${q.number}`] ?? 'mojitest';
      if (prefer === 'mojitest') {
        alt.set(q.number, q.answerIndex);
        q.answerIndex = Number(k);
      } else alt.set(q.number, Number(k));
    }
    fact.answerCheck = check;
    compared += check.compared;
    agreed += check.agreed;
  }

  fact.questions = [...lang, ...listen].map((q) => {
    const f = toFact(q);
    if (q.part === 'language' && alt.has(q.number)) f.altAnswerIndex = alt.get(q.number);
    return f;
  });
  totalQ += fact.questions.length;
  writeFileSync(join(outDir, `${level}-${session}.json`), `${JSON.stringify(fact, null, 1)}\n`);
  summary.push(
    `${level} ${session}  lang:${lang.length}(${fact.sources.language ?? '-'})  listen:${listen.length}` +
      (fact.answerCheck ? `  核对 ${fact.answerCheck.agreed}/${fact.answerCheck.compared}` : ''),
  );
}

console.log(summary.join('\n'));
console.log(`\n共 ${sessionKeys.length} 场、${totalQ} 题；答案交叉核对 ${agreed}/${compared} 一致（${compared ? ((agreed / compared) * 100).toFixed(1) : '-'}%）`);
if (warnings.length) console.log(`\n警告 ${warnings.length} 条：\n${warnings.slice(0, 30).join('\n')}`);
