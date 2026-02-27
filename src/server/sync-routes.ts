/**
 * Phase D — Mobile Sync Engine
 *
 * POST /api/sync/push   — mobile sends mutations, server applies them
 * GET  /api/sync/pull   — mobile polls for server-side changes since a timestamp
 * GET  /api/sync/status — per-user sync metadata
 *
 * Entity types handled:
 *   document        → prisma Document (slug/content/title)
 *   bundle_progress → mobile_bundle_progress
 *   task            → mobile_task
 *   flashcard_review→ mobile_flashcard_review
 *
 * Conflict strategy: last-write-wins (updatedAt comparison)
 * Auth: Bearer token from auth_session table (or dev mode if no token)
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from './db.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Mutation {
  entityType: 'document' | 'bundle_progress' | 'task' | 'flashcard_review';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  clientTs?: string; // ISO — client-side updatedAt for conflict check
}

interface PushResult {
  entityType: string;
  entityId: string;
  status: 'ok' | 'conflict' | 'error';
  serverTs?: string;
  reason?: string;
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function resolveUserId(request: any): Promise<string | null> {
  const auth = request.headers.authorization as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const session = await (prisma as any).auth_session.findUnique({ where: { id: token } });
    return session?.user_id ?? null;
  } catch {
    return null;
  }
}

// ─── Mutation handlers ────────────────────────────────────────────────────────

async function applyDocument(userId: string, entityId: string, operation: string, payload: any): Promise<PushResult> {
  try {
    if (operation === 'delete') {
      await (prisma as any).document.updateMany({
        where: { slug: entityId, userId },
        data: { isPublished: false, updatedAt: new Date() },
      });
      return { entityType: 'document', entityId, status: 'ok' };
    }

    const data = {
      title: payload.title || 'Untitled',
      content: payload.content ?? '',
      slug: entityId,
      userId,
      updatedAt: new Date(),
      metadata: { source: 'mobile', bundleSlug: payload.bundleSlug ?? null, ...(payload.metadata ?? {}) },
    };

    // Check server version for conflict detection
    if (payload.clientTs) {
      const serverDoc = await (prisma as any).document.findFirst({ where: { slug: entityId, userId }, select: { updatedAt: true } });
      if (serverDoc?.updatedAt && new Date(payload.clientTs) < serverDoc.updatedAt) {
        // Server is newer — conflict, keep server version
        return { entityType: 'document', entityId, status: 'conflict', serverTs: serverDoc.updatedAt.toISOString(), reason: 'server_newer' };
      }
    }

    await (prisma as any).document.upsert({
      where: { slug: entityId },
      create: { ...data, createdAt: new Date() },
      update: data,
    });

    return { entityType: 'document', entityId, status: 'ok', serverTs: new Date().toISOString() };
  } catch (e: any) {
    return { entityType: 'document', entityId, status: 'error', reason: e.message };
  }
}

async function applyBundleProgress(userId: string, entityId: string, operation: string, payload: any): Promise<PushResult> {
  try {
    const { bundleSlug, moduleId, completed, score, timeSpentSeconds, completedAt } = payload;
    if (!bundleSlug || !moduleId) return { entityType: 'bundle_progress', entityId, status: 'error', reason: 'missing bundleSlug/moduleId' };

    await (prisma as any).$executeRaw`
      INSERT INTO mobile_bundle_progress (user_id, bundle_slug, module_id, completed, score, time_spent_sec, completed_at, updated_at)
      VALUES (${userId}, ${bundleSlug}, ${moduleId}, ${completed ?? false}, ${score ?? null}, ${timeSpentSeconds ?? null},
              ${completedAt ? new Date(completedAt) : null}, NOW())
      ON CONFLICT (user_id, bundle_slug, module_id)
      DO UPDATE SET
        completed = EXCLUDED.completed,
        score = COALESCE(EXCLUDED.score, mobile_bundle_progress.score),
        time_spent_sec = COALESCE(EXCLUDED.time_spent_sec, mobile_bundle_progress.time_spent_sec),
        completed_at = COALESCE(EXCLUDED.completed_at, mobile_bundle_progress.completed_at),
        updated_at = NOW()
    `;
    return { entityType: 'bundle_progress', entityId, status: 'ok', serverTs: new Date().toISOString() };
  } catch (e: any) {
    return { entityType: 'bundle_progress', entityId, status: 'error', reason: e.message };
  }
}

async function applyTask(userId: string, entityId: string, operation: string, payload: any): Promise<PushResult> {
  try {
    if (operation === 'delete') {
      await (prisma as any).$executeRaw`UPDATE mobile_task SET deleted = true, updated_at = NOW() WHERE id = ${entityId} AND user_id = ${userId}`;
      return { entityType: 'task', entityId, status: 'ok' };
    }

    // Conflict: skip if server updated_at is newer
    if (payload.clientTs) {
      const rows: any[] = await (prisma as any).$queryRaw`SELECT updated_at FROM mobile_task WHERE id = ${entityId} AND user_id = ${userId}`;
      if (rows[0]?.updated_at && new Date(payload.clientTs) < rows[0].updated_at) {
        return { entityType: 'task', entityId, status: 'conflict', serverTs: rows[0].updated_at.toISOString(), reason: 'server_newer' };
      }
    }

    await (prisma as any).$executeRaw`
      INSERT INTO mobile_task (id, user_id, title, done, priority, due_date, notes, deleted, created_at, updated_at)
      VALUES (
        ${entityId}, ${userId}, ${payload.title ?? 'Task'}, ${payload.done ?? false},
        ${payload.priority ?? null}, ${payload.dueDate ? new Date(payload.dueDate) : null},
        ${payload.notes ?? null}, false, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        done = EXCLUDED.done,
        priority = EXCLUDED.priority,
        due_date = EXCLUDED.due_date,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;
    return { entityType: 'task', entityId, status: 'ok', serverTs: new Date().toISOString() };
  } catch (e: any) {
    return { entityType: 'task', entityId, status: 'error', reason: e.message };
  }
}

async function applyFlashcardReview(userId: string, entityId: string, _operation: string, payload: any): Promise<PushResult> {
  try {
    const { cardId, deckId, quality, easeFactor, intervalDays } = payload;
    if (!cardId || !deckId || quality === undefined) return { entityType: 'flashcard_review', entityId, status: 'error', reason: 'missing fields' };

    await (prisma as any).$executeRaw`
      INSERT INTO mobile_flashcard_review (user_id, card_id, deck_id, quality, ease_factor, interval_days, reviewed_at)
      VALUES (${userId}, ${cardId}, ${deckId}, ${quality}, ${easeFactor ?? 2.5}, ${intervalDays ?? 1}, NOW())
    `;
    return { entityType: 'flashcard_review', entityId, status: 'ok' };
  } catch (e: any) {
    return { entityType: 'flashcard_review', entityId, status: 'error', reason: e.message };
  }
}

async function logSync(userId: string, mutations: Mutation[], results: PushResult[]) {
  const resultMap = new Map(results.map(r => [r.entityType + ':' + r.entityId, r]));
  for (const m of mutations) {
    const r = resultMap.get(m.entityType + ':' + m.entityId);
    try {
      await (prisma as any).$executeRaw`
        INSERT INTO mobile_sync_log (user_id, entity_type, entity_id, operation, payload, conflict, processed, created_at)
        VALUES (${userId}, ${m.entityType}, ${m.entityId}, ${m.operation}, ${JSON.stringify(m.payload)}::jsonb,
                ${r?.status === 'conflict'}, ${r?.status !== 'error'}, NOW())
      `;
    } catch { /* non-critical */ }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerSyncRoutes(app: FastifyInstance) {

  /**
   * POST /api/sync/push
   * Body: { mutations: Mutation[] }
   * Applies mobile mutations to Postgres. Returns per-mutation results.
   */
  app.post<{ Body: { mutations: Mutation[] } }>('/api/sync/push', async (request, reply) => {
    const userId = await resolveUserId(request) ?? `anon:${(request.ip || 'local')}`;
    const { mutations } = request.body;

    if (!Array.isArray(mutations) || mutations.length === 0) {
      return reply.status(400).send({ error: 'mutations must be a non-empty array' });
    }
    if (mutations.length > 200) {
      return reply.status(400).send({ error: 'max 200 mutations per push' });
    }

    const results: PushResult[] = [];

    for (const m of mutations) {
      let result: PushResult;
      switch (m.entityType) {
        case 'document':
          result = await applyDocument(userId, m.entityId, m.operation, m.payload);
          break;
        case 'bundle_progress':
          result = await applyBundleProgress(userId, m.entityId, m.operation, m.payload);
          break;
        case 'task':
          result = await applyTask(userId, m.entityId, m.operation, m.payload);
          break;
        case 'flashcard_review':
          result = await applyFlashcardReview(userId, m.entityId, m.operation, m.payload);
          break;
        default:
          result = { entityType: m.entityType, entityId: m.entityId, status: 'error', reason: 'unknown entity type' };
      }
      results.push(result);
    }

    // Async audit log (fire-and-forget)
    logSync(userId, mutations, results).catch(() => {});

    const ok = results.filter(r => r.status === 'ok').length;
    const conflicts = results.filter(r => r.status === 'conflict').length;
    const errors = results.filter(r => r.status === 'error').length;

    return {
      ok: true,
      processed: results.length,
      summary: { ok, conflicts, errors },
      serverTs: new Date().toISOString(),
      results,
    };
  });

  /**
   * GET /api/sync/pull?since=<ISO>
   * Returns server-side changes since the given timestamp.
   * Returns: { documents, bundleProgress, tasks }
   */
  app.get<{ Querystring: { since?: string } }>('/api/sync/pull', async (request, reply) => {
    const userId = await resolveUserId(request) ?? `anon:${(request.ip || 'local')}`;
    const sinceRaw = request.query.since;
    const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default 7d

    try {
      // Documents updated on server since last sync
      const documents = await (prisma as any).document.findMany({
        where: { userId, updatedAt: { gt: since } },
        select: { id: true, slug: true, title: true, content: true, updatedAt: true, metadata: true },
        take: 100,
        orderBy: { updatedAt: 'asc' },
      });

      // Bundle progress updated on server since last sync
      const bundleProgress: any[] = await (prisma as any).$queryRaw`
        SELECT bundle_slug, module_id, completed, score, time_spent_sec, completed_at, updated_at
        FROM mobile_bundle_progress
        WHERE user_id = ${userId} AND updated_at > ${since}
        ORDER BY updated_at ASC
        LIMIT 500
      `;

      // Tasks updated on server since last sync
      const tasks: any[] = await (prisma as any).$queryRaw`
        SELECT id, title, done, priority, due_date, notes, deleted, updated_at
        FROM mobile_task
        WHERE user_id = ${userId} AND updated_at > ${since}
        ORDER BY updated_at ASC
        LIMIT 200
      `;

      // Latest flashcard reviews (for history, not state)
      const reviews: any[] = await (prisma as any).$queryRaw`
        SELECT card_id, deck_id, quality, ease_factor, interval_days, reviewed_at
        FROM mobile_flashcard_review
        WHERE user_id = ${userId} AND reviewed_at > ${since}
        ORDER BY reviewed_at ASC
        LIMIT 500
      `;

      return {
        ok: true,
        serverTs: new Date().toISOString(),
        since: since.toISOString(),
        documents: documents.map((d: any) => ({
          slug: d.slug,
          title: d.title,
          content: d.content,
          updatedAt: d.updatedAt?.toISOString(),
          metadata: d.metadata,
        })),
        bundleProgress: bundleProgress.map((r: any) => ({
          bundleSlug: r.bundle_slug,
          moduleId: r.module_id,
          completed: r.completed,
          score: r.score,
          timeSpentSeconds: r.time_spent_sec,
          completedAt: r.completed_at?.toISOString(),
          updatedAt: r.updated_at?.toISOString(),
        })),
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          priority: t.priority,
          dueDate: t.due_date?.toISOString(),
          notes: t.notes,
          deleted: t.deleted,
          updatedAt: t.updated_at?.toISOString(),
        })),
        flashcardReviews: reviews.map((r: any) => ({
          cardId: r.card_id,
          deckId: r.deck_id,
          quality: r.quality,
          easeFactor: parseFloat(r.ease_factor),
          intervalDays: r.interval_days,
          reviewedAt: r.reviewed_at?.toISOString(),
        })),
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  /**
   * GET /api/sync/status
   * Returns sync health for the current user.
   */
  app.get('/api/sync/status', async (request, reply) => {
    const userId = await resolveUserId(request) ?? `anon:${(request.ip || 'local')}`;

    try {
      const [docCount, progressCount, taskCount, reviewCount, lastSync]: any[] = await Promise.all([
        (prisma as any).document.count({ where: { userId } }),
        (prisma as any).$queryRaw`SELECT COUNT(*) FROM mobile_bundle_progress WHERE user_id = ${userId}`,
        (prisma as any).$queryRaw`SELECT COUNT(*) FROM mobile_task WHERE user_id = ${userId} AND deleted = false`,
        (prisma as any).$queryRaw`SELECT COUNT(*) FROM mobile_flashcard_review WHERE user_id = ${userId}`,
        (prisma as any).$queryRaw`SELECT MAX(created_at) as ts FROM mobile_sync_log WHERE user_id = ${userId}`,
      ]);

      return {
        ok: true,
        userId,
        stats: {
          documents: Number(docCount),
          bundleModules: Number(progressCount[0]?.count ?? 0),
          tasks: Number(taskCount[0]?.count ?? 0),
          flashcardReviews: Number(reviewCount[0]?.count ?? 0),
        },
        lastPushAt: lastSync[0]?.ts?.toISOString() ?? null,
        serverTs: new Date().toISOString(),
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  /**
   * GET /api/sync/log?limit=50
   * Last N sync events for the current user (for debugging).
   */
  app.get<{ Querystring: { limit?: string } }>('/api/sync/log', async (request, reply) => {
    const userId = await resolveUserId(request) ?? `anon:${(request.ip || 'local')}`;
    const limit = Math.min(parseInt(request.query.limit ?? '50', 10) || 50, 200);

    try {
      const rows: any[] = await (prisma as any).$queryRaw`
        SELECT entity_type, entity_id, operation, conflict, processed, created_at
        FROM mobile_sync_log
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return { ok: true, log: rows };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  /**
   * POST /api/sync/ai/chat
   * Mobile-optimised AI chat (accepts bare {messages:[{role,content}]}).
   * Proxies to the server's AI service.
   */
  app.post<{ Body: { messages: Array<{ role: string; content: string }> } }>(
    '/api/sync/ai/chat',
    async (request, reply) => {
      const { messages } = request.body;
      if (!Array.isArray(messages)) return reply.status(400).send({ error: 'messages required' });

      try {
        // Reuse the existing AI chat endpoint handler
        const aiUrl = process.env.AI_PROXY_URL || 'http://localhost:4444';
        const res = await fetch(`${aiUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.AI_API_KEY || '' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: messages.filter(m => m.role !== 'system'),
            system: messages.find(m => m.role === 'system')?.content ?? 'You are a helpful AI assistant in ANKR Interact.',
          }),
        });
        const data = await res.json() as any;
        const reply_text = data?.content?.[0]?.text ?? data?.error?.message ?? '(no response)';
        return { reply: reply_text };
      } catch (e: any) {
        return reply.status(502).send({ error: `AI proxy unavailable: ${e.message}` });
      }
    }
  );

  console.log('  🔄 Phase D sync routes registered: /api/sync/{push,pull,status,log,ai/chat}');
}
