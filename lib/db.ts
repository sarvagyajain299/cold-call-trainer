import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "@/db/schema";

const sqlite = new Database(path.join(process.cwd(), "trainer.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    offer TEXT NOT NULL,
    price TEXT NOT NULL DEFAULT '',
    ideal_customer TEXT NOT NULL DEFAULT '',
    call_goal TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    preset_id TEXT NOT NULL,
    profile TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    persona TEXT,
    conversation_id TEXT,
    status TEXT NOT NULL DEFAULT 'setup',
    report TEXT,
    created_at INTEGER NOT NULL
  );
`);

// Columns added after the first release.
try {
  sqlite.exec('ALTER TABLE sessions ADD COLUMN self_review TEXT');
} catch {
  // column already exists
}

export const db = drizzle(sqlite, { schema });
