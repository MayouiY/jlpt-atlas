// 解析 MOJiTest 浏览器内提取脚本（extract-in-browser.js）输出的行格式文本。
import {
  LANGUAGE_MONDAI_ORDER,
  LISTENING_MONDAI_ORDER,
  MONDAI_BY_MOJI_CODE,
  type Level,
  type MondaiType,
} from '../../../src/lib/domain.ts';
import type { RawQuestion } from '../../lib/types.ts';

export interface MojiSession {
  examId: string;
  level: Level;
  session: string; // YYYY-MM
  full: boolean; // 是否包含言語知識・読解的题目内容
  questions: RawQuestion[];
  structure: { part: 'language' | 'listening'; mondaiNo: number; type: MondaiType; items: number }[];
  answerKey?: string;
  warnings: string[];
}

export function sessionFromTitle(title: string): string | null {
  const m = /(\d{4})年(\d{1,2})月/.exec(title);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : null;
}

export function parseMojiText(text: string): MojiSession {
  const lines = text.split('\n');
  const head = lines[0].split('|');
  if (head[0] !== '#EXAM') throw new Error('缺少 #EXAM 头');
  const examId = head[1];
  const level = head[2] as Level;
  const session = sessionFromTitle(head[3]);
  if (!session) throw new Error(`无法解析场次：${head[3]}`);
  const url = `https://test.mojidict.com/paper/analysis/${examId}--${encodeURIComponent(head[3] + level)}`;
  const out: MojiSession = { examId, level, session, full: false, questions: [], structure: [], warnings: [] };
  let langNo = 0;
  let listenNo = 0;
  let curType: MondaiType | null = null;
  let curNo = 0;
  let curPart: 'language' | 'listening' = 'language';
  for (const line of lines.slice(1)) {
    if (!line) continue;
    if (line.startsWith('#KEY|')) {
      out.answerKey = line.slice(5);
      continue;
    }
    if (line.startsWith('!ERR')) {
      out.warnings.push(line);
      continue;
    }
    const f = line.split('|');
    if (f[0] === '@L') {
      const code = Number(f[1]);
      const type = MONDAI_BY_MOJI_CODE[code];
      if (!type) {
        out.warnings.push(`未知题型编码 ${code}`);
        curType = null;
        continue;
      }
      curType = type;
      curPart = code >= 41 ? 'listening' : 'language';
      curNo = curPart === 'listening' ? ++listenNo : ++langNo;
      // 校验：题型应与官方顺序一致
      const expected = curPart === 'listening' ? LISTENING_MONDAI_ORDER[curNo - 1] : LANGUAGE_MONDAI_ORDER[level][curNo - 1];
      if (expected !== type) out.warnings.push(`问题${curNo} 题型 ${type} 与官方顺序 ${expected} 不一致`);
      out.structure.push({ part: curPart, mondaiNo: curNo, type, items: Number(f[3]) || 0 });
      continue;
    }
    const code = Number(f[0]);
    const type = MONDAI_BY_MOJI_CODE[code];
    if (!type || type !== curType) {
      out.warnings.push(`行与当前大题不符：${f[0]}`);
      continue;
    }
    const answerIndex = f[2] === '' || f[2] === undefined ? null : Number(f[2]);
    const base = {
      level,
      session,
      mondaiNo: curNo,
      type,
      number: f[1],
      answerIndex: Number.isFinite(answerIndex) ? answerIndex : null,
      source: 'mojitest' as const,
      sourceUrl: url,
    };
    if (code >= 41) {
      out.questions.push({
        ...base,
        part: 'listening',
        listen: { image: f[3] === '1', scene: f[4] || '', question: code === 45 ? '' : f.slice(5).join('|'), utterance: code === 45 ? f.slice(5).join('|') : '' },
      });
    } else if (code >= 31) {
      out.full = true;
      out.questions.push({ ...base, part: 'language', stem: f.slice(3).join('|') });
    } else {
      out.full = true;
      const opts = f.slice(4).join('|');
      const q: RawQuestion = { ...base, part: 'language' };
      if (type === 'usage') q.target = f[3];
      else {
        if (type === 'kanji_reading' || type === 'orthography' || type === 'paraphrase') q.target = f[3];
        q.options = opts ? opts.split('/') : [];
        if (q.options.length !== 4 && q.options.length !== 0) out.warnings.push(`${session} ${level} 第${f[1]}题 选项数 ${q.options.length}`);
      }
      out.questions.push(q);
    }
  }
  // 个别场次听力题号重复（如两个「3番」），按出现顺序重新编号
  const byMondai = new Map<number, RawQuestion[]>();
  for (const q of out.questions) if (q.part === 'listening') byMondai.set(q.mondaiNo, [...(byMondai.get(q.mondaiNo) ?? []), q]);
  for (const [no, qs] of byMondai) {
    const nums = qs.map((q) => q.number);
    if (new Set(nums).size === nums.length) continue;
    let i = 0;
    for (const q of qs) if (/^\d+番$/.test(q.number)) q.number = `${++i}番`;
    out.warnings.push(`听力问题${no} 题号重复，已按顺序重新编号`);
  }
  return out;
}
