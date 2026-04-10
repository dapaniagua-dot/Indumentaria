// Database abstraction layer - SQLite for dev, PostgreSQL for production
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL || '';
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_PG = DATABASE_URL.startsWith('postgresql://') || DATABASE_URL.startsWith('postgres://');

let pool = null;
let sqlite = null;

export async function getDB() {
  if (USE_PG) {
    if (!pool) {
      const pg = await import('pg');
      pool = new pg.default.Pool({
        connectionString: DATABASE_URL,
        ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
    }
    return { type: 'pg', pool };
  } else {
    if (!sqlite) {
      const Database = (await import('better-sqlite3')).default;
      const dbPath = path.join(__dirname, 'data.db');
      sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
    }
    return { type: 'sqlite', db: sqlite };
  }
}

// Unified query interface
export async function query(sql, params = []) {
  const conn = await getDB();

  if (conn.type === 'pg') {
    // Convert ? placeholders to $1, $2, etc. for pg
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await conn.pool.query(pgSql, params);
    return result.rows;
  } else {
    // SQLite
    const stmt = conn.db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT') ||
        sql.trim().toUpperCase().startsWith('PRAGMA')) {
      return stmt.all(...params);
    } else {
      stmt.run(...params);
      return [];
    }
  }
}

// Execute raw SQL (for CREATE TABLE, etc.)
export async function exec(sql) {
  const conn = await getDB();
  if (conn.type === 'pg') {
    await conn.pool.query(sql);
  } else {
    conn.db.exec(sql);
  }
}

// Get a single row
export async function queryOne(sql, params = []) {
  const conn = await getDB();
  if (conn.type === 'pg') {
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await conn.pool.query(pgSql, params);
    return result.rows[0] || null;
  } else {
    return conn.db.prepare(sql).get(...params) || null;
  }
}

export { USE_PG };
