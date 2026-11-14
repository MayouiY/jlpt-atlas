// 对构建出的单文件数据库做完整性检查
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';

let db: Database;
const q = <T = Record<string, unknown>>(sql: string, p: (string | number)[] = []): T[] => {
  const st = db.prepare(sql);
  st.bind(p);
  const out: T[] = [];
  while (st.step()) out.push(st.getAsObject() as T);
  st.free();
  return out;
};
const scalar = (sql: string, p: (string | number)[] = []) => Object.values(q(sql, p)[0] ?? {})[0] as number;

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database(readFileSync(join(__dirname, '../data/jlpt-atlas.db')));
});

describe('jlpt-atlas.db', () => {
  it('场次目录完整：2010-07 起每年两场，2020-07 取消，下一场待举行', () => {
    expect(scalar("SELECT COUNT(*) FROM exam_session WHERE status = 'held'")).toBe(32);
    expect(scalar("SELECT status FROM exam_session WHERE id = '2020-07'") as unknown).toBe('cancelled');
    expect(scalar("SELECT id FROM exam_session WHERE status = 'upcoming'") as unknown).toBe('2026-12');
    expect(scalar("SELECT MAX(seq) FROM exam_session")).toBe(32);
  });

  it('N1/N2 每个已举行场次都有言语知识、阅读与听力题', () => {
    const rows = q<{ level: string; session_id: string; lang: number; listen: number }>(
      `SELECT level, session_id, SUM(part = 'language') AS lang, SUM(part = 'listening') AS listen FROM question GROUP BY level, session_id`,
    );
    expect(rows).toHaveLength(64);
    for (const r of rows) {
      expect(r.lang, `${r.level} ${r.session_id}`).toBeGreaterThanOrEqual(60);
      expect(r.listen, `${r.level} ${r.session_id}`).toBeGreaterThanOrEqual(28);
    }
  });

  it('外键与关联一致', () => {
    expect(scalar('SELECT COUNT(*) FROM question_kp qk LEFT JOIN knowledge_point k ON k.id = qk.kp_id WHERE k.id IS NULL')).toBe(0);
    expect(scalar('SELECT COUNT(*) FROM question_kp qk LEFT JOIN question x ON x.id = qk.question_id WHERE x.id IS NULL')).toBe(0);
    expect(scalar('SELECT COUNT(*) FROM question q LEFT JOIN exam_session s ON s.id = q.session_id WHERE s.id IS NULL')).toBe(0);
    expect(scalar("SELECT COUNT(*) FROM question WHERE answer_index IS NULL AND part = 'language'")).toBe(0);
  });

  it('统计值自洽', () => {
    expect(scalar('SELECT COUNT(*) FROM kp_stats WHERE sessions > 32 OR sessions > tested')).toBe(0);
    // kp_stats 与 kp_session 一致
    const bad = scalar(
      `SELECT COUNT(*) FROM kp_stats s WHERE s.level IN ('N1','N2') AND s.sessions <>
        (SELECT COUNT(*) FROM kp_session ks WHERE ks.kp_id = s.kp_id AND ks.level = s.level AND ks.tested > 0)`,
    );
    expect(bad).toBe(0);
  });

  it('每道阅读/听力题都有信息提取方式标签', () => {
    expect(scalar("SELECT COUNT(*) FROM question WHERE mondai_type LIKE 'reading%' AND skill IS NULL")).toBe(0);
    expect(scalar("SELECT COUNT(*) FROM question WHERE mondai_type LIKE 'listen%' AND skill IS NULL")).toBe(0);
  });

  it('下次考试的预测与回测已生成', () => {
    for (const lv of ['N1', 'N2']) {
      expect(scalar("SELECT COUNT(*) FROM prediction WHERE level = ? AND grp = 'grammar' AND target_session = '2026-12'", [lv])).toBeGreaterThan(100);
      expect(scalar("SELECT COUNT(*) FROM prediction WHERE level = ? AND grp = 'listening_skill'", [lv])).toBeGreaterThan(5);
      expect(scalar("SELECT COUNT(*) FROM backtest WHERE level = ? AND grp = 'grammar'", [lv])).toBe(40);
    }
  });

  it('不含题干/篇章/听力原文字段', () => {
    const cols = q<{ name: string }>("SELECT name FROM pragma_table_info('question')").map((c) => c.name);
    for (const banned of ['text', 'stem', 'passage', 'script', 'subtitle', 'transcript']) expect(cols).not.toContain(banned);
    // 用法题只保存考查词，不保存整句选项
    expect(scalar("SELECT COUNT(*) FROM question WHERE mondai_type IN ('usage','sentence_composition') AND options IS NOT NULL")).toBe(0);
  });
});
