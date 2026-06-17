import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.db");

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

async function getSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export async function initDb(): Promise<Database> {
  if (db) return db;

  const sql = await getSql();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new sql.Database(buffer);
  } else {
    db = new sql.Database();
  }

  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  // ── Rooms ──
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      code        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Messages ──
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id                TEXT PRIMARY KEY,
      room_code         TEXT NOT NULL,
      sender_nickname   TEXT NOT NULL,
      sender_session_id TEXT NOT NULL,
      content           TEXT NOT NULL,
      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (room_code) REFERENCES rooms(code)
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_room_time
      ON messages(room_code, created_at DESC)
  `);

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function dbRun(sql: string, params?: any[]) {
  const database = getDb();
  database.run(sql, params);
  saveDb();
}

export function dbGet(sql: string, params?: any[]): any | undefined {
  const database = getDb();
  const stmt = database.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function dbAll(sql: string, params?: any[]): any[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  if (params) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
