# Show HN: ANKR Interact — Open-source knowledge OS (Obsidian + Anki + Google Classroom)

**Hacker News title (74 chars):**
```
Show HN: ANKR Interact – open-source Obsidian+Anki+Classroom, offline-first
```

_Alternative titles:_
```
Show HN: We built an open-source portable learning bundle format (.ib) for offline education
Show HN: ANKR Interact – replace Notion+Obsidian+Classroom+Anki with one Apache 2.0 app
```

---

## Post Body

Hi HN,

A teacher in Patna told us she was paying ₹1,800/month for four apps to run her online coaching business — Notion for course notes, Google Classroom for assignments, a quiz app, and Obsidian on her laptop for her own thinking. She was absorbing the cost so her students didn't have to.

That's why we built ANKR Interact. GitHub: https://github.com/ankr-labs/interact

---

**The .ib bundle format**

The core idea is a portable content package — a zip with a spec:

```
manifest.json      ← semver, author, per-file sha256 hashes, HMAC-SHA256 signature
docs/*.md          ← content in plain Markdown
flashcards.json    ← SM-2 spaced repetition deck
quiz.json          ← auto-graded questions with explanations
canvas.json        ← Excalidraw whiteboard state
media/             ← embedded images
```

A teacher creates a bundle. A student downloads it once. It plays fully offline — no CDN call, no server ping, no subscription check. The format is open (Apache 2.0 spec in `BUNDLE-SPEC.md`). Bundles are versioned (`1.0.0` → `1.1.0`) with semantic diff and integrity verification. You can sign bundles with HMAC-SHA256 and distribute them via QR code.

The bundle carries its own quiz engine and spaced repetition scheduler. It's closer to an executable document than a PDF.

---

**Import from anywhere**

We support importing existing content into `.ib` bundles:

- **Notion**: upload the ZIP export → markdown pages + CSV databases become docs + flashcards + AI quiz
- **Obsidian**: zip your vault → all `.md` files imported, wiki-links preserved, link index auto-generated
- **Anki `.apkg`**: we open the SQLite `collection.anki2` with `better-sqlite3`, parse the `\x1f`-delimited note fields, strip HTML tags, and produce a flashcard deck
- **Quizlet**: CSV (tab-separated) or JSON export → flashcard deck
- **Word `.docx`**: `mammoth` → Markdown conversion + AI-generated flashcards
- **Excel `.xlsx`**: each sheet becomes a markdown table; 2-column sheets (Term | Definition) become flashcard decks automatically
- **YouTube playlists**: fetch captions via timedtext API → AI generates chapters + flashcards + quiz per video
- **SWAYAM/NPTEL/DIKSHA**: course URL → full offline bundle

All outputs are `.ib v2` bundles with play + download links.

---

**Offline AI tutor**

On mobile (Expo/React Native), the AI tutor runs on-device via `llama.rn` — a React Native binding for Llama 3.2 3B. ~15 tok/sec on a 2022 mid-range Android. No network call. You can ask it questions about your bundle content while on a 2G train.

Web uses the Anthropic API (BYOK — bring your own key, or use the cloud tier).

---

**The classroom module**

Assignments *are* bundles, not links to content somewhere else. The student plays the bundle offline; quiz scores are submitted on next sync. No "paste a Google Doc" workflow. Attendance is tracked by bundle completion events.

---

**Tech stack**

- Fastify + Mercurius (GraphQL) · PostgreSQL + pgvector · Tiptap block editor
- Excalidraw + Yjs (collaborative canvas) · D3.js (knowledge graph)
- Expo/React Native + SQLite + Drizzle ORM (offline-first mobile)
- Jina embeddings (free 1M/month, 88% MTEB — replaced Voyage at $120/mo)
- `@fastify/multipart` for file imports · `jszip` + `better-sqlite3` + `mammoth` + `xlsx` for format parsing

---

**Pricing**

- Free self-host forever (`docker compose up`)
- ₹299/mo (~$3.50) Learner Pro — cloud sync + AI tutor
- ₹599/mo Creator — marketplace publishing, analytics, AI Studio
- Marketplace: 70/30 revenue split to creators

₹299/month is deliberately less than a single night at a coaching center.

---

**Honest caveats**

- Marketplace is sparsely seeded (handful of NCERT and UPSC bundles)
- Mobile app is functional but pending store submission
- The `.ib` spec is v2 — we'll likely break it once more before v3 stabilizes
- Self-host Docker image is ~1.8GB (Llama model included)

---

**What we'd love feedback on**

1. Is `.ib` a reasonable format, or are we reinventing SCORM badly?
2. The Anki import path uses `better-sqlite3` to read `.apkg` directly — any edge cases we're missing with Anki 2.1+ deck formats?
3. Offline-first with SQLite + sync-on-reconnect: we're using a last-write-wins conflict resolver right now. Anyone done this better without CRDTs?
4. Any obvious attack surface in the self-hosting setup?

PRs welcome — especially for OPDS catalog support, better conflict resolution, and WebRTC live sessions.

— ANKR Labs team, Gurgaon, India

---

## Pre-drafted comment responses

**"Why not just Notion + Anki + Google Classroom?"**
> The gap is portability and the assignment loop. In Obsidian your notes don't become Anki cards. In Google Classroom the assignment is a *link* to content elsewhere, not the content itself. And none of it works offline on a 2G train. The `.ib` format is our attempt at a content package that carries its own player — like an EPUB that also bundles its own quiz engine and spaced repetition scheduler.

**"Is this SCORM?"**
> Conceptually similar goal, completely different execution. SCORM is XML-heavy, LMS-dependent, and predates modern JS. `.ib` is a zip of Markdown + JSON, readable by any text editor, verifiable with sha256, versioned with semver, and playable with a 50-line JS parser. We published the spec as `BUNDLE-SPEC.md` so anyone can implement a reader.

**"What's the AI actually doing?"**
> Four things: (1) on-device tutor via llama.rn — answers questions about bundle content, no network; (2) bundle generator — type a topic, get 8 chapters + 40 flashcards + 20 quiz questions in ~30 seconds; (3) import pipeline — converts YouTube/SWAYAM/Notion/Anki/DOCX/XLSX into `.ib` bundles; (4) AI character system — generates SVG sprite teachers with personality + catchphrases for gamified bundles.

**"Why India-first?"**
> 40% of India has 4G coverage but not reliability. If your learning app makes a network round-trip to render a flashcard, you lose those users. Offline-first isn't a feature — it's the baseline. The ₹299/mo price reflects Indian purchasing power parity; we'll add regional pricing if there's international traction.

**"Self-hosting?"**
> `git clone https://github.com/ankr-labs/interact && docker compose up` — ~2 minutes including DB migrations. See `SELF_HOSTING.md`. Requires Docker, 2GB RAM (4GB recommended if running the on-device Llama model). PostgreSQL included in the compose file. AI features need an Anthropic API key or work with the local llama.rn runtime.
