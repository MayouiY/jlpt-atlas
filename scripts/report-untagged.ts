// 列出语法类题目中正确答案未能匹配到任何句型的情况，便于补充 data/seed/grammar.yaml。
// 用法：npm run report:untagged
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import initSqlJs from 'sql.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(join(ROOT, 'data/jlpt-atlas.db')));
const res = db.exec(`
  SELECT q.level, q.mondai_type, q.answer, COUNT(*) AS n
  FROM question q
  WHERE q.mondai_type IN ('grammar_form', 'text_grammar') AND q.answer IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM question_kp qk JOIN knowledge_point k ON k.id = qk.kp_id
                    WHERE qk.question_id = q.id AND qk.role = 'answer' AND k.kind = 'grammar')
  GROUP BY q.level, q.mondai_type, q.answer ORDER BY n DESC, q.level`);
const rows = res[0]?.values ?? [];
const total = db.exec(`SELECT COUNT(*) FROM question WHERE mondai_type IN ('grammar_form','text_grammar')`)[0].values[0][0] as number;
console.log(`未匹配句型的语法题答案：${rows.reduce((a, r) => a + Number(r[3]), 0)} / ${total} 题`);
for (const [level, type, answer, n] of rows) console.log(`${level}\t${type}\t${answer}${Number(n) > 1 ? `\t×${n}` : ''}`);
