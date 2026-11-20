import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "@/db/schema";

export const sqlite = new Database(path.join(process.cwd(), "trainer.db"));
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
  CREATE TABLE IF NOT EXISTS cheat_sheets (
    preset_id TEXT PRIMARY KEY,
    sections TEXT NOT NULL,
    generated_at INTEGER,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prospect_types (
    id TEXT PRIMARY KEY,
    preset_id TEXT NOT NULL,
    label TEXT NOT NULL,
    profile TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS llm_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    kind TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    title TEXT NOT NULL,
    rule TEXT NOT NULL,
    data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    screen INTEGER NOT NULL DEFAULT 0,
    gut_pick TEXT,
    best_score REAL,
    review_step INTEGER NOT NULL DEFAULT 0,
    next_review_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (session_id, ord)
  );
  CREATE TABLE IF NOT EXISTS practice_attempts (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    mode TEXT NOT NULL,
    is_review INTEGER NOT NULL DEFAULT 0,
    transcript TEXT NOT NULL,
    audio_path TEXT,
    duration_sec REAL,
    speaking_sec REAL,
    wpm INTEGER,
    result TEXT,
    score REAL,
    error TEXT,
    created_at INTEGER NOT NULL
  );
`);

// Columns added after the first release.
try {
  sqlite.exec('ALTER TABLE sessions ADD COLUMN self_review TEXT');
} catch {
  // column already exists
}

try {
  sqlite.exec("ALTER TABLE sessions ADD COLUMN sheet_shown INTEGER");
} catch {
  // column already exists
}

try {
  sqlite.exec("ALTER TABLE sessions ADD COLUMN script_used TEXT");
} catch {
  // column already exists
}

try {
  sqlite.exec("ALTER TABLE sessions ADD COLUMN cue_card TEXT");
} catch {
  // column already exists
}

export const db = drizzle(sqlite, { schema });
