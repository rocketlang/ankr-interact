/**
 * Mutation Queue — queues writes when offline, replays when reconnected
 *
 * Every local write (create/update/delete) that needs to sync to the server
 * is added to this queue. The sync engine processes it when online.
 */

import { db } from '../db/client';
import { syncQueue } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { isOnline } from './network-monitor';
import * as Crypto from 'expo-crypto';

export type EntityType = 'document' | 'flashcard_card' | 'flashcard_review' | 'task' | 'bundle_progress';
export type Operation = 'create' | 'update' | 'delete';

export interface QueuedMutation {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: Operation;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

export async function enqueue(
  entityType: EntityType,
  entityId: string,
  operation: Operation,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${entityType}:${entityId}:${operation}:${Date.now()}`,
  );

  await db.insert(syncQueue).values({
    id: id.slice(0, 36),
    entityType,
    entityId,
    operation,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

// ── Dequeue all pending ───────────────────────────────────────────────────────

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const rows = await db
    .select()
    .from(syncQueue)
    .orderBy(asc(syncQueue.createdAt))
    .all();

  return rows.map(r => ({
    ...r,
    payload: JSON.parse(r.payload),
    attempts: r.attempts ?? 0,
    lastError: r.lastError,
  })) as QueuedMutation[];
}

// ── Mark success ──────────────────────────────────────────────────────────────

export async function removeMutation(id: string): Promise<void> {
  await db.delete(syncQueue).where(eq(syncQueue.id, id));
}

// ── Mark failure ──────────────────────────────────────────────────────────────

export async function markFailed(id: string, error: string): Promise<void> {
  const rows = await db.select({ attempts: syncQueue.attempts }).from(syncQueue).where(eq(syncQueue.id, id)).all();
  const currentAttempts = rows[0]?.attempts ?? 0;

  await db
    .update(syncQueue)
    .set({ attempts: currentAttempts + 1, lastError: error })
    .where(eq(syncQueue.id, id));
}

// ── Queue size ────────────────────────────────────────────────────────────────

export async function getQueueSize(): Promise<number> {
  const rows = await db.select({ id: syncQueue.id }).from(syncQueue).all();
  return rows.length;
}

// ── Clear all (use carefully) ─────────────────────────────────────────────────

export async function clearQueue(): Promise<void> {
  await db.delete(syncQueue);
}
