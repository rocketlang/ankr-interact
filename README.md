# ANKR Interact

**One app. Replace five tools.**

> Open-source knowledge OS that combines Obsidian + Notion + NotebookLM + Google Classroom + Duolingo + Miro — with a mobile-first, offline-first, bundle-native architecture.

[![Apache 2.0 License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Self-hostable](https://img.shields.io/badge/self--host-Docker%20Compose-green.svg)](SELF_HOSTING.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Why ANKR Interact?

Today you pay for and switch between five separate tools:

| What you need | Tool today | Cost/mo | ANKR Interact |
|--------------|------------|---------|---------------|
| Knowledge graph + wiki-links | Obsidian Sync | $10 | ✅ Built-in |
| Docs + databases + kanban | Notion | $16 | ✅ Built-in |
| AI chat over your documents | NotebookLM | $20 | ✅ Built-in |
| Classroom + assignments + LMS | Google Classroom | $6/user | ✅ Built-in |
| Gamified learning + flashcards | Duolingo | $7 | ✅ Built-in |
| Whiteboard + real-time collab | Miro | $16 | ✅ Built-in |
| **Total** | **6 apps** | **$75+/mo** | **₹299/mo or self-host free** |

---

## Features

### Knowledge Management (Obsidian-like)
- Bidirectional wiki-links `[[like this]]` with live graph visualization
- D3.js force-directed knowledge graph
- Backlinks panel — see everything that links to a document
- Full-text + semantic search (vector embeddings, works offline)
- Auto-tagging via AI, document versioning

### Block Editor (Notion-like)
- Rich block editor powered by Tiptap
- Math equations (LaTeX), Mermaid diagrams, Kanban boards
- Databases, timelines, calendars, callouts, image galleries
- Code syntax highlighting, embeds, file attachments
- Wiki-link autocomplete, templates gallery

### AI Document Q&A (NotebookLM-like)
- Notebook mode: chat with any set of documents
- Auto-summarization, key point extraction
- Practice problem generation from your notes
- Works with your own AI API key or self-hosted Ollama

### Learning & Classroom (Google Classroom-like)
- Full LMS: classrooms, assignments, attendance, grading
- Teacher analytics: misconception detection, concept mastery heatmap
- Student progress tracking, parent notifications
- Gamification: XP, badges, leaderboards, streaks

### Spaced Repetition (Duolingo-like)
- Flashcard decks with SM-2 spaced repetition
- 23 languages including all major Indian languages
- Gamified study sessions, daily streaks
- Auto-generate flashcards from documents

### Whiteboard (Miro-like)
- Excalidraw canvas with real-time collaboration (Yjs)
- Live cursors, presence indicators, frame navigation
- Presentation mode, export to PNG/SVG/PDF
- Canvas comments, block ↔ canvas conversion

### The `.ib` Bundle — Our Core Innovation
Share a self-contained knowledge package with anyone:
```
bundle.ib
├── docs/          ← markdown documents
├── quizzes/       ← assessment JSON
├── flashcards/    ← spaced repetition decks
├── courses/       ← structured learning paths
├── canvas/        ← whiteboard snapshots
└── manifest.json  ← metadata, license, author
```
One file. Drag and drop to import. Play offline. Share via QR code.

---

## Quick Start

### Option 1 — Docker (recommended)
```bash
docker compose up -d
# → opens at http://localhost:3199
```

### Option 2 — Local
```bash
git clone https://github.com/rocketlang/ankr-interact
cd ankr-interact
cp .env.example .env
pnpm install
pnpm run db:push
pnpm run dev
# → opens at http://localhost:3199
```

### Option 3 — Mobile App (Expo)
```bash
cd mobile
npm install
# Start dev server
npx expo start

# Build APK (requires EAS account)
eas build --platform android --profile preview
```

**App features:**
- Offline-first SQLite vault (Drizzle ORM + expo-sqlite)
- Import `.ib` bundles directly from your phone
- SM-2 spaced repetition flashcards with streaks
- AI Chat (connects to your self-hosted server)
- Classroom join-by-code student view
- Delta sync to your ANKR Interact server when online
- Deep link: `ankrinteract://import?url=...`

Android: [Google Play](#) (coming soon) | [Direct APK](#)
iOS: [TestFlight](#) (coming soon)

---

## Comparison

### vs Obsidian

| Feature | Obsidian | ANKR Interact |
|---------|----------|--------------|
| Knowledge graph | ✅ | ✅ |
| Offline-first | ✅ | ✅ |
| Mobile app | ⚠️ Limited | ✅ Native |
| Real-time collaboration | ⚠️ Plugin ($) | ✅ Built-in |
| LMS / Classroom | ❌ | ✅ |
| AI tutor | ❌ | ✅ |
| Bundle sharing | ❌ | ✅ |
| Self-host | ✅ | ✅ |
| Price (cloud sync) | $10/mo | Free (self-host) / ₹299/mo |

### vs Notion

| Feature | Notion | ANKR Interact |
|---------|--------|--------------|
| Block editor | ✅ | ✅ |
| Databases | ✅ | ✅ |
| Offline-first | ❌ | ✅ |
| Knowledge graph | ❌ | ✅ |
| LMS / Classroom | ❌ | ✅ |
| Self-host | ❌ | ✅ |
| India pricing | ❌ | ✅ ₹299/mo |
| OSS | ❌ | ✅ Apache 2.0 |

### vs Google Classroom

| Feature | Google Classroom | ANKR Interact |
|---------|-----------------|--------------|
| LMS basics | ✅ | ✅ |
| Knowledge base | ❌ | ✅ |
| AI tutoring | ❌ | ✅ |
| Offline | ❌ | ✅ |
| Self-host / privacy | ❌ | ✅ |
| Bundle sharing | ❌ | ✅ |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│             ANKR Interact                   │
│                                             │
│  Web App (3199)  ·  Mobile (Expo)  ·  CLI   │
│         │                │                  │
│    ┌────▼────────────────▼────┐             │
│    │      SQLite / Postgres   │             │
│    │   (offline-first vault)  │             │
│    └────────────┬─────────────┘             │
│                 │ optional sync              │
│    ┌────────────▼─────────────┐             │
│    │   Cloud Postgres (EON)   │             │
│    └──────────────────────────┘             │
└─────────────────────────────────────────────┘
```

**Stack:** Fastify · Mercurius (GraphQL) · Prisma · PostgreSQL · React 19 · Tiptap · Excalidraw · Yjs · D3.js · Expo

---

## Self-Hosting

See [SELF_HOSTING.md](SELF_HOSTING.md) for a full guide including:
- Docker Compose setup
- PostgreSQL configuration
- Reverse proxy (Nginx/Caddy)
- Environment variables
- AI API key setup (optional)

---

## Pricing

| Tier | Price | What's included |
|------|-------|----------------|
| **OSS / Self-host** | Free forever | Everything, self-managed |
| **Learner Pro** | ₹299/mo ($4) | Cloud sync, AI tutor, mobile |
| **Creator** | ₹999/mo ($12) | Bundle marketplace, monetize your bundles |
| **Team** | ₹299/user/mo | Classrooms, collaboration, analytics |
| **Enterprise** | Custom | SSO, audit logs, white-label, SLA |

---

## Bundle Marketplace

Browse, import, and publish knowledge bundles at the [ANKR Interact Marketplace](#).

**Seed bundles (free):**
- NCERT Class 10 Science
- UPSC GS Paper 1 (History + Geography + Polity)
- Logistics & Freight Operations 101
- Maritime & Port Operations
- Security Fundamentals (MITRE ATT&CK)

**Create and sell your own** — 70% revenue to creator, 30% to platform.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

- **Bug reports** → [GitHub Issues](https://github.com/rocketlang/ankr-interact/issues)
- **Feature requests** → [GitHub Discussions](https://github.com/rocketlang/ankr-interact/discussions)
- **Bundle templates** → Submit a PR to `/bundles/templates/`
- **Language packs** → Add to `/src/i18n/`
- **Editor extensions** → See [EXTENSION_GUIDE.md](docs/EXTENSION_GUIDE.md)

---

## The `.ib` Bundle Format

ANKR Interact introduces a portable knowledge format — the **Interact Bundle** (`.ib`).

```
bundle.ib  (ZIP archive)
├── manifest.json     ← metadata, integrity hashes, author, license
├── docs/             ← markdown documents with wiki-links
├── assets/           ← images, PDFs, audio
├── quizzes/          ← assessment JSON
├── flashcards/       ← spaced repetition decks
├── courses/          ← structured learning path definition
└── canvas/           ← Excalidraw whiteboard snapshots
```

**How it works:**
1. Author selects docs, quizzes, and flashcards from their vault
2. Exports as `bundle.ib` — a signed, integrity-checked zip
3. Shares via download link, QR code, or `ankrinteract://import?url=...` deep link
4. Recipient imports on web or mobile — plays fully offline

**See:** [BUNDLE-SPEC.md](BUNDLE-SPEC.md) for the complete format specification.

---

## Roadmap

- [x] Phase 9 — Web platform (197 endpoints, 23 languages, full LMS)
- [x] Phase A — OSS repo + Docker self-host ✅
- [x] Phase B — `.ib` bundle format + export/import/player/QR ✅
- [x] Phase C — Mobile app (Expo, Android + iOS) ✅
- [x] Phase D — Sync engine (offline ↔ cloud) ✅ — see [SYNC-PROTOCOL.md](SYNC-PROTOCOL.md)
- [ ] Phase E — Bundle marketplace
- [ ] Phase F — On-device AI (Llama)

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

The OSS core (knowledge graph, block editor, canvas, LMS, bundle format) is Apache 2.0.
Cloud sync, AI tutor, and marketplace features are available under ANKR Cloud Terms.

---

**Made with care in Gurgaon, India 🇮🇳 by [ANKR Labs](https://ankrlabs.in)**

---
*Co-authored by Capt Anil Kumar Sharma, Powerp Box IT Solutions Pvt Ltd*
