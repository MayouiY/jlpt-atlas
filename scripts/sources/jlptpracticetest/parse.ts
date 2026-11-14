// 解析 jlptpracticetest.com 场次页面（Next.js RSC 负载）中的题目结构。
// 页面是公开的（robots.txt 允许 /n1/ /n2/），这里只在内存中解析，
// 输出 RawQuestion；题干/篇章不会被持久化。
import { LANGUAGE_MONDAI_ORDER, type Level, type MondaiType } from '../../../src/lib/domain.ts';
import type { RawQuestion } from '../../lib/types.ts';

/** 把 self.__next_f.push([1,"..."]) 中的字符串片段拼接还原。 */
export function decodeRscChunks(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = '';
  for (let m = re.exec(html); m; m = re.exec(html)) out += JSON.parse(`"${m[1]}"`);
  return out;
}

/** 找出包含指定键的所有 JSON 对象（括号配平扫描）。 */
export function findObjectsWithKey(text: string, key: string): Record<string, unknown>[] {
  const needle = `"${key}"`;
  const results: Record<string, unknown>[] = [];
  let pos = 0;
  for (;;) {
    const k = text.indexOf(needle, pos);
    if (k < 0) break;
    // 向前找到包住该键的 '{'
    let depth = 0;
    let j = k;
    for (; j >= 0; j--) {
      const c = text[j];
      if (c === '}') depth++;
      else if (c === '{') {
        if (depth === 0) break;
        depth--;
      }
    }
    // 向后找到配对的 '}'
    let e = j;
    let inStr = false;
    let esc = false;
    depth = 0;
    for (; e < text.length; e++) {
      const c = text[e];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= 0 && e > k) {
      try {
        results.push(JSON.parse(text.slice(j, e + 1)));
      } catch {
        /* 非 JSON 片段，忽略 */
      }
      pos = e + 1;
    } else pos = k + 1;
  }
  return results;
}

interface RscQuestion {
  questionNumber: number;
  text?: string;
  textHtml?: string;
  options?: string[];
  correctAnswer?: number;
}

interface RscGroup {
  instruction: string;
  questions: RscQuestion[];
}

const ZEN_DIGITS: Record<string, string> = { '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9' };

export function mondaiNoFromInstruction(instruction: string): number | null {
  const norm = instruction.replace(/[０-９]/g, (d) => ZEN_DIGITS[d]).replace(/\s+/g, '');
  const m = /問題(\d{1,2})/.exec(norm);
  return m ? Number(m[1]) : null;
}

const clean = (s: string) => s.replace(/[\s　]+/g, '').trim();

function underline(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const m = /\[\[u\]\]([\s\S]*?)\[\[\/u\]\]/.exec(html);
  return m ? clean(m[1].replace(/\[\[[^\]]*\]\]/g, '')) : undefined;
}

/** 解析一个场次页面 HTML（vocabulary 或 grammar 页）。 */
export function parseSessionPage(html: string, level: Level, session: string, sourceUrl: string): RawQuestion[] {
  const text = decodeRscChunks(html);
  const groups = findObjectsWithKey(text, 'instruction').filter(
    (g): g is RscGroup & Record<string, unknown> => typeof g.instruction === 'string' && Array.isArray(g.questions),
  );
  const out: RawQuestion[] = [];
  for (const g of groups) {
    const mondaiNo = mondaiNoFromInstruction(g.instruction);
    if (!mondaiNo) continue;
    const type: MondaiType | undefined = LANGUAGE_MONDAI_ORDER[level][mondaiNo - 1];
    if (!type) continue;
    for (const q of g.questions) {
      const answerIndex = typeof q.correctAnswer === 'number' ? q.correctAnswer - 1 : null;
      const raw: RawQuestion = {
        level,
        session,
        part: 'language',
        mondaiNo,
        type,
        number: String(q.questionNumber),
        answerIndex,
        source: 'jlptpracticetest',
        sourceUrl,
      };
      const opts = (q.options ?? []).map(clean);
      switch (type) {
        case 'kanji_reading':
        case 'orthography':
        case 'paraphrase':
          raw.target = underline(q.textHtml);
          raw.options = opts;
          break;
        case 'usage':
          raw.target = clean(q.text ?? '');
          break;
        case 'word_formation':
        case 'context':
        case 'grammar_form':
        case 'sentence_composition':
        case 'text_grammar':
          raw.options = opts;
          break;
        default:
          raw.stem = clean(q.text ?? '');
      }
      out.push(raw);
    }
  }
  return out;
}

/** 文件名 n1_202412_vocabulary.html → {level, session, section} */
export function parseCacheFileName(name: string): { level: Level; session: string; section: string } | null {
  const m = /^n([12])_(\d{4})(\d{2})_(vocabulary|grammar)\.html$/.exec(name);
  if (!m) return null;
  return { level: `N${m[1]}` as Level, session: `${m[2]}-${m[3]}`, section: m[4] };
}
