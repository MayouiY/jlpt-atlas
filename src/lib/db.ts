// 在浏览器中用 sql.js（SQLite 的 WebAssembly 版本）直接打开单文件数据库。
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import dbUrl from '../../data/jlpt-atlas.db?url';

let dbPromise: Promise<Database> | null = null;
let db: Database | null = null;

export function loadDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [SQL, buf] = await Promise.all([
        initSqlJs({ locateFile: () => wasmUrl }),
        fetch(dbUrl).then((r) => {
          if (!r.ok) throw new Error(`数据库加载失败：HTTP ${r.status}`);
          return r.arrayBuffer();
        }),
      ]);
      db = new SQL.Database(new Uint8Array(buf));
      return db;
    })();
  }
  return dbPromise;
}

export type Params = SqlValue[] | Record<string, SqlValue>;

/** 执行查询并以对象数组返回（同步；数据库须已加载）。 */
export function all<T = Record<string, SqlValue>>(sql: string, params: Params = []): T[] {
  if (!db) throw new Error('数据库尚未加载');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function one<T = Record<string, SqlValue>>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}
