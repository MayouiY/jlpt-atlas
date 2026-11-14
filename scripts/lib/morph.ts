// 基于 kuromoji（IPADIC）的词汇原形、读音、词性判断。
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// kuromoji 没有类型声明，这里只用到很少的接口
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kuromoji = require('kuromoji') as any;

export interface Token {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  basic_form: string;
  reading?: string;
}

export interface Tokenizer {
  tokenize(text: string): Token[];
}

export function loadTokenizer(): Promise<Tokenizer> {
  const dicPath = join(dirname(require.resolve('kuromoji/package.json')), 'dict');
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err: Error | null, tk: Tokenizer) => (err ? reject(err) : resolve(tk)));
  });
}

export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const HAN = /\p{Script=Han}/u;

/** 去掉选项中常见的活用尾巴，得到词典形（原形）。 */
export function lemmatize(tk: Tokenizer, word: string): string {
  let w = word.normalize('NFKC').replace(/[\s　]/g, '');
  if (/な$/.test(w) && w.length > 2 && HAN.test(w)) {
    const toks = tk.tokenize(w.slice(0, -1));
    if (toks.length === 1 && toks[0].pos === '名詞') return w.slice(0, -1);
  }
  const toks = tk.tokenize(w);
  if (toks.length <= 1) {
    const t = toks[0];
    if (t && (t.pos === '動詞' || t.pos === '形容詞') && t.basic_form && t.basic_form !== '*') return t.basic_form;
    return w;
  }
  // 找最后一个自立的动词/形容词，把它之前的部分与它的原形拼起来
  let idx = -1;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if ((t.pos === '動詞' && t.pos_detail_1 === '自立') || (t.pos === '形容詞' && t.pos_detail_1 === '自立')) idx = i;
  }
  if (idx >= 0 && toks[idx].basic_form && toks[idx].basic_form !== '*') {
    // 若后面紧跟非自立动词（如「合う」「始める」以外的补助），保留到该自立词为止
    w = toks.slice(0, idx).map((t) => t.surface_form).join('') + toks[idx].basic_form;
    return w;
  }
  return w;
}

export function readingOf(tk: Tokenizer, word: string): string | undefined {
  const toks = tk.tokenize(word);
  if (!toks.length) return undefined;
  const r = toks.map((t) => (t.reading && t.reading !== '*' ? t.reading : /^[ぁ-んァ-ヶー]+$/.test(t.surface_form) ? t.surface_form : '?')).join('');
  if (r.includes('?')) return undefined;
  return kataToHira(r);
}

/** 词性大类（中文）。 */
export function vocabPos(tk: Tokenizer, word: string): string {
  const w = word.normalize('NFKC');
  if (/^[ァ-ヶー・]+$/.test(w)) return '外来语（片假名）';
  if (/^([ぁ-ん]{2})\1$/.test(w) || /^[ぁ-ん]っ[ぁ-ん]り$/.test(w) || /^[ぁ-ん]ん[ぁ-ん]り$/.test(w)) return '拟声拟态词';
  const toks = tk.tokenize(w);
  if (!toks.length) return '其他';
  const content = toks.filter((t) => !['助詞', '助動詞', '記号'].includes(t.pos));
  const main = content[0] ?? toks[0];
  const verbs = toks.filter((t) => t.pos === '動詞');
  if (main.pos === '動詞') {
    if (verbs.length >= 2 || /^\p{Script=Han}[ぁ-ん]{0,2}\p{Script=Han}[ぁ-ん]+$/u.test(w) && /^\p{Script=Han}[いきしちにひみりぎじびえけせてねへめれげべ]/u.test(w)) return '复合动词';
    return '动词';
  }
  if (main.pos === '形容詞') return 'い形容词';
  if (main.pos === '名詞' && main.pos_detail_1 === '形容動詞語幹') return 'な形容词';
  if (main.pos === '名詞' && content.length >= 2 && content.some((t) => t.pos === '動詞')) return '惯用语・词组';
  if (main.pos === '名詞') return '名词';
  if (main.pos === '副詞') return '副词';
  if (main.pos === '連体詞') return '连体词';
  if (main.pos === '接続詞') return '接续词';
  if (main.pos === '接頭詞') return '接头词';
  return '其他';
}
