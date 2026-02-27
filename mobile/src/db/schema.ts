/**
 * ANKR Interact Mobile — Drizzle SQLite Schema
 * Mirrors the core Prisma schema for offline-first local storage.
 */

import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

// ── Documents ─────────────────────────────────────────────────────────────────

export const documents = sqliteTable('documents', {
  id:          text('id').primaryKey(),
  slug:        text('slug').notNull().unique(),
  title:       text('title').notNull(),
  content:     text('content').notNull().default(''),
  path:        text('path'),
  source:      text('source').default('local'),    // local | bundle | synced
  bundleSlug:  text('bundle_slug'),                // which bundle it came from
  wordCount:   integer('word_count').default(0),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at').notNull(),
  syncedAt:    text('synced_at'),                  // last synced with server
  isDirty:     integer('is_dirty', { mode: 'boolean' }).default(false), // pending sync
});

export const tags = sqliteTable('tags', {
  id:   text('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const documentTags = sqliteTable('document_tags', {
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  tagId:      text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

export const documentLinks = sqliteTable('document_links', {
  id:         text('id').primaryKey(),
  sourceSlug: text('source_slug').notNull(),
  targetSlug: text('target_slug').notNull(),
  linkText:   text('link_text'),
});

// ── Bundles ───────────────────────────────────────────────────────────────────

export const bundles = sqliteTable('bundles', {
  id:           text('id').primaryKey(),
  slug:         text('slug').notNull().unique(),
  name:         text('name').notNull(),
  description:  text('description'),
  authorName:   text('author_name'),
  language:     text('language').default('en'),
  subject:      text('subject'),
  tags:         text('tags'),                       // JSON array string
  access:       text('access').default('public'),
  license:      text('license').default('Apache-2.0'),
  filePath:     text('file_path'),                  // local .ib file path
  fileSize:     integer('file_size'),
  manifestJson: text('manifest_json'),              // full manifest JSON
  importedAt:   text('imported_at').notNull(),
  isDownloaded: integer('is_downloaded', { mode: 'boolean' }).default(true),
});

export const bundleProgress = sqliteTable('bundle_progress', {
  id:                text('id').primaryKey(),
  bundleSlug:        text('bundle_slug').notNull().references(() => bundles.slug, { onDelete: 'cascade' }),
  moduleId:          text('module_id').notNull(),
  completed:         integer('completed', { mode: 'boolean' }).default(false),
  score:             real('score'),
  timeSpentSeconds:  integer('time_spent_seconds').default(0),
  completedAt:       text('completed_at'),
  updatedAt:         text('updated_at').notNull(),
});

// ── Flashcards ────────────────────────────────────────────────────────────────

export const flashcardDecks = sqliteTable('flashcard_decks', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  docId:     text('doc_id').references(() => documents.id),
  bundleSlug: text('bundle_slug'),
  createdAt: text('created_at').notNull(),
});

export const flashcardCards = sqliteTable('flashcard_cards', {
  id:       text('id').primaryKey(),
  deckId:   text('deck_id').notNull().references(() => flashcardDecks.id, { onDelete: 'cascade' }),
  front:    text('front').notNull(),
  back:     text('back').notNull(),
  imageUri: text('image_uri'),
  tags:     text('tags'),                           // JSON array
  // SM-2 fields
  easeFactor:    real('ease_factor').default(2.5),
  interval:      integer('interval').default(1),    // days
  repetitions:   integer('repetitions').default(0),
  dueDate:       text('due_date').notNull(),         // ISO date string
  lastReviewed:  text('last_reviewed'),
});

export const flashcardReviews = sqliteTable('flashcard_reviews', {
  id:         text('id').primaryKey(),
  cardId:     text('card_id').notNull().references(() => flashcardCards.id, { onDelete: 'cascade' }),
  rating:     integer('rating').notNull(),           // 0=again 1=hard 2=good 3=easy
  reviewedAt: text('reviewed_at').notNull(),
  timeMs:     integer('time_ms'),
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
  id:          text('id').primaryKey(),
  title:       text('title').notNull(),
  description: text('description'),
  status:      text('status').default('todo'),       // todo | in_progress | done
  priority:    text('priority').default('medium'),   // low | medium | high
  dueDate:     text('due_date'),
  tags:        text('tags'),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at').notNull(),
  isDirty:     integer('is_dirty', { mode: 'boolean' }).default(false),
});

// ── Sync queue ────────────────────────────────────────────────────────────────

export const syncQueue = sqliteTable('sync_queue', {
  id:          text('id').primaryKey(),
  entityType:  text('entity_type').notNull(),        // document | flashcard | task | bundle_progress
  entityId:    text('entity_id').notNull(),
  operation:   text('operation').notNull(),           // create | update | delete
  payload:     text('payload').notNull(),             // JSON
  createdAt:   text('created_at').notNull(),
  attempts:    integer('attempts').default(0),
  lastError:   text('last_error'),
});

// ── Settings ──────────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});

// ── Streaks ───────────────────────────────────────────────────────────────────

export const streaks = sqliteTable('streaks', {
  id:              text('id').primaryKey().default('default'),
  currentStreak:   integer('current_streak').default(0),
  longestStreak:   integer('longest_streak').default(0),
  lastStudyDate:   text('last_study_date'),
  totalCardsStudied: integer('total_cards_studied').default(0),
  totalXP:         integer('total_xp').default(0),
});
