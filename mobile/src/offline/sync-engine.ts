/**
 * Sync Engine — push local mutations to server, pull remote changes
 *
 * Uses delta sync: sends mutations since last sync, receives
 * server changes since last pull timestamp.
 */

import { create } from 'zustand';
import { getPendingMutations, removeMutation, markFailed } from './mutation-queue';
import { isOnline } from './network-monitor';
import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

interface SyncStore {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
  setSyncing: (v: boolean) => void;
  setLastSynced: (t: string) => void;
  setPendingCount: (n: number) => void;
  setError: (e: string | null) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  pendingCount: 0,
  lastError: null,
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSynced: (lastSyncedAt) => set({ lastSyncedAt, lastError: null }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setError: (lastError) => set({ lastError }),
}));

// ── Load persisted sync state ─────────────────────────────────────────────────

export async function loadSyncState() {
  const rows = await db.select().from(settings)
    .where(eq(settings.key, 'last_synced_at')).all();
  if (rows[0]) {
    useSyncStore.getState().setLastSynced(rows[0].value);
  }
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function sync(serverUrl: string, authToken?: string): Promise<void> {
  const store = useSyncStore.getState();
  if (store.isSyncing || !isOnline()) return;

  store.setSyncing(true);
  store.setError(null);

  try {
    const mutations = await getPendingMutations();
    store.setPendingCount(mutations.length);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    // ── PUSH: send local mutations ──────────────────────────────────────────
    for (const mutation of mutations) {
      if (mutation.attempts >= 5) continue; // give up after 5 tries

      try {
        const res = await fetch(`${serverUrl}/api/sync/push`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            operation: mutation.operation,
            payload: mutation.payload,
            clientTimestamp: mutation.createdAt,
          }),
        });

        if (res.ok) {
          await removeMutation(mutation.id);
        } else {
          const err = await res.text();
          await markFailed(mutation.id, err);
        }
      } catch (e: unknown) {
        await markFailed(mutation.id, e instanceof Error ? e.message : String(e));
      }
    }

    // ── PULL: fetch server changes since last sync ──────────────────────────
    const lastSync = store.lastSyncedAt || '2020-01-01T00:00:00.000Z';
    const pullRes = await fetch(
      `${serverUrl}/api/sync/pull?since=${encodeURIComponent(lastSync)}`,
      { headers },
    );

    if (pullRes.ok) {
      const { entities } = await pullRes.json() as {
        entities: Array<{ type: string; id: string; data: Record<string, unknown>; deletedAt?: string }>;
      };

      // Apply pulled changes to local SQLite
      // (simplified — full implementation handles conflict resolution per entity type)
      for (const entity of entities) {
        try {
          await applyRemoteChange(entity);
        } catch (e) {
          console.warn('Failed to apply remote change:', entity.id, e);
        }
      }
    }

    // ── Record sync time ────────────────────────────────────────────────────
    const now = new Date().toISOString();
    await db.insert(settings)
      .values({ key: 'last_synced_at', value: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: now } });

    store.setLastSynced(now);
    const remaining = await getPendingMutations();
    store.setPendingCount(remaining.length);

  } catch (e: unknown) {
    store.setError(e instanceof Error ? e.message : String(e));
  } finally {
    store.setSyncing(false);
  }
}

// ── Apply a remote entity change to local SQLite ──────────────────────────────

async function applyRemoteChange(entity: { type: string; id: string; data: Record<string, unknown>; deletedAt?: string }) {
  // Simplified — a full implementation would use last-write-wins per field
  // This is where vector clocks would be applied
  console.log('[sync] remote change:', entity.type, entity.id, entity.deletedAt ? '(deleted)' : '(upsert)');
}
