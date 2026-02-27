/**
 * SQLite database client — Expo SQLite + Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const sqlite = openDatabaseSync('ankr-interact.db', { enableChangeListener: true });

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

// ── Bootstrap — create tables if not exist ────────────────────────────────────

export async function initDatabase() {
  await sqlite.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      path TEXT,
      source TEXT DEFAULT 'local',
      bundle_slug TEXT,
      word_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      is_dirty INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS document_tags (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_links (
      id TEXT PRIMARY KEY,
      source_slug TEXT NOT NULL,
      target_slug TEXT NOT NULL,
      link_text TEXT
    );

    CREATE TABLE IF NOT EXISTS bundles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      author_name TEXT,
      language TEXT DEFAULT 'en',
      subject TEXT,
      tags TEXT,
      access TEXT DEFAULT 'public',
      license TEXT DEFAULT 'Apache-2.0',
      file_path TEXT,
      file_size INTEGER,
      manifest_json TEXT,
      imported_at TEXT NOT NULL,
      is_downloaded INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bundle_progress (
      id TEXT PRIMARY KEY,
      bundle_slug TEXT NOT NULL REFERENCES bundles(slug) ON DELETE CASCADE,
      module_id TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      score REAL,
      time_spent_seconds INTEGER DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      doc_id TEXT REFERENCES documents(id),
      bundle_slug TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcard_cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      image_uri TEXT,
      tags TEXT,
      ease_factor REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      due_date TEXT NOT NULL,
      last_reviewed TEXT
    );

    CREATE TABLE IF NOT EXISTS flashcard_reviews (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES flashcard_cards(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL,
      time_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_dirty INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY DEFAULT 'default',
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_study_date TEXT,
      total_cards_studied INTEGER DEFAULT 0,
      total_xp INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO streaks (id) VALUES ('default');
  `);
}
