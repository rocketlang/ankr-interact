# ANKR Interact — Mobile Sync Protocol (Phase D)

The sync engine lets the mobile app (SQLite) stay in sync with any ANKR Interact server (Postgres) using a delta-based push/pull protocol.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/sync/push` | Mobile sends local mutations to server |
| `GET`  | `/api/sync/pull?since=<ISO>` | Mobile fetches server-side changes |
| `GET`  | `/api/sync/status` | Per-user sync statistics |
| `GET`  | `/api/sync/log?limit=50` | Recent sync events (debug) |
| `POST` | `/api/sync/ai/chat` | AI chat proxy for mobile |

## Push — Mutation Format

```json
POST /api/sync/push
Authorization: Bearer <token>

{
  "mutations": [
    {
      "entityType": "document",
      "entityId": "my-doc-slug",
      "operation": "create",
      "payload": {
        "title": "My Document",
        "content": "# Hello\n\nMarkdown content...",
        "clientTs": "2026-02-27T10:00:00.000Z"
      }
    },
    {
      "entityType": "bundle_progress",
      "entityId": "unique-id",
      "operation": "update",
      "payload": {
        "bundleSlug": "ncert-class10-science",
        "moduleId": "mod-01",
        "completed": true,
        "timeSpentSeconds": 420
      }
    },
    {
      "entityType": "task",
      "entityId": "task-uuid-here",
      "operation": "update",
      "payload": {
        "title": "Read chapter 3",
        "done": true,
        "clientTs": "2026-02-27T10:00:00.000Z"
      }
    },
    {
      "entityType": "flashcard_review",
      "entityId": "review-id",
      "operation": "create",
      "payload": {
        "cardId": "card-uuid",
        "deckId": "deck-uuid",
        "quality": 4,
        "easeFactor": 2.6,
        "intervalDays": 4
      }
    }
  ]
}
```

### Push Response

```json
{
  "ok": true,
  "processed": 4,
  "summary": { "ok": 3, "conflicts": 1, "errors": 0 },
  "serverTs": "2026-02-27T10:00:01.000Z",
  "results": [
    { "entityType": "document", "entityId": "my-doc-slug", "status": "ok", "serverTs": "..." },
    { "entityType": "bundle_progress", "entityId": "...", "status": "ok" },
    { "entityType": "task", "entityId": "...", "status": "conflict", "serverTs": "...", "reason": "server_newer" },
    { "entityType": "flashcard_review", "entityId": "...", "status": "ok" }
  ]
}
```

## Pull — Delta Response

```json
GET /api/sync/pull?since=2026-02-26T00:00:00.000Z

{
  "ok": true,
  "serverTs": "2026-02-27T10:00:01.000Z",
  "since": "2026-02-26T00:00:00.000Z",
  "documents": [
    { "slug": "...", "title": "...", "content": "...", "updatedAt": "..." }
  ],
  "bundleProgress": [
    { "bundleSlug": "...", "moduleId": "...", "completed": true, "updatedAt": "..." }
  ],
  "tasks": [
    { "id": "...", "title": "...", "done": false, "deleted": false, "updatedAt": "..." }
  ],
  "flashcardReviews": [
    { "cardId": "...", "deckId": "...", "quality": 4, "easeFactor": 2.6, "intervalDays": 4, "reviewedAt": "..." }
  ]
}
```

## Conflict Strategy

**Last-write-wins** per entity: if `payload.clientTs` is older than the server's `updatedAt`, the push is rejected with `status: "conflict"` and `serverTs` is returned so the mobile can pull the server version.

The mobile app then:
1. Receives the conflict result
2. On next `pull`, fetches the server's version
3. Overwrites local SQLite with server data

## Entity Types

| `entityType` | Server Table | Notes |
|-------------|-------------|-------|
| `document` | `Document` (Prisma) | Identified by `slug` + `userId` |
| `bundle_progress` | `mobile_bundle_progress` | Per user+bundle+module |
| `task` | `mobile_task` | Soft-delete via `deleted: true` |
| `flashcard_review` | `mobile_flashcard_review` | Append-only, no conflicts |

## Auth

- `Authorization: Bearer <token>` — matched against `auth_session.id` in Postgres
- Without a token: mutations are stored under `anon:<ip>` (useful for standalone/local use)

## Database Tables Created

```sql
mobile_sync_log          — audit trail of every push
mobile_bundle_progress   — bundle module completion per user
mobile_task              — mobile kanban tasks
mobile_flashcard_review  — SM-2 review history
```

All tables use `CREATE TABLE IF NOT EXISTS` — safe to re-run, no data loss.
