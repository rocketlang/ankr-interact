# Show HN: ANKR Interact — Open-source knowledge OS (Obsidian + Duolingo + Google Classroom)

**Hacker News title (80 chars max):**
```
Show HN: ANKR Interact – open-source Obsidian+Duolingo+Classroom in one app
```

_Alternative titles:_
```
Show HN: We built an open-source .ib bundle format for portable interactive learning
Show HN: ANKR Interact – self-hosted knowledge OS with AI tutor, flashcards, classrooms
```

---

## Post Body

Hi HN,

Over the past 6 months we've been building **ANKR Interact** — an open-source knowledge platform that combines note-taking, interactive learning bundles, AI tutoring, and classroom management.

**GitHub:** https://github.com/ankr-labs/ankr-interact
**Live:** https://ankrinteract.com

---

**Why we built it**

We run a logistics/freight SaaS company in India (ANKR Labs). Our ops team kept reaching for 4 different tools:
- Notion for SOPs
- Anki for memorization
- Google Classroom for driver training
- Duolingo for language learning (we have Hindi-speaking drivers)

Each integration was duct tape. We decided to build one thing.

---

**The .ib bundle format** is the core idea — a zip file containing:

```
bundle.ib
├── manifest.json      (v2 spec, features flags)
├── chapters/          (markdown docs)
├── flashcards/        (SM-2 deck)
├── quiz/              (multiple choice)
├── courses/           (structured path)
├── characters/        (SVG sprite AI teacher — 5 states)
├── audio/             (podcast episodes)
├── comics/            (panel scripts with character avatars)
└── social/            (LinkedIn/Twitter/WhatsApp content)
```

Bundles are portable — you can download, share via QR, sell on the marketplace (70% creator share), or import into your self-hosted instance.

---

**Tech stack** (all boring, all real):

- Fastify + Mercurius (GraphQL)
- PostgreSQL + pgvector (semantic search)
- Tiptap block editor
- Excalidraw + Yjs (collaborative canvas)
- D3.js (knowledge graph)
- Expo/React Native (offline-first mobile, SM-2 spaced repetition via SQLite)
- Anthropic API for AI tutor (BYOK — bring your own key)
- Jina embeddings (free 1M/month tier)

---

**What's live today:**

- 314 TypeScript files, 197+ API endpoints
- 23 languages, full RTL
- Marketplace with Razorpay (Indian payments)
- AI character system — generates cartoon teacher SVG sprites with personality + catchphrases
- Comic strip generator — topic → panel script with character dialogue
- Podcast analyzer — transcript → chapters + flashcards + social posts
- Docker Compose self-host in under 60 seconds

---

**Honest caveats:**

- We're a startup, not a research lab. AI features use Claude via AI proxy — not local LLMs (though llama.rn on-device inference works on mobile for basic tasks).
- The marketplace is live but sparsely seeded (14 bundles so far: NCERT Physics, UPSC geography, logistics SOPs, maritime compliance, xShield security course).
- Mobile app is functional but store submission is pending.

---

**What we'd love feedback on:**

1. Is the `.ib` format a good idea, or are we inventing a format nobody asked for?
2. Would educators actually use this, or is Google Classroom too entrenched?
3. The pricing (₹299/mo Pro ≈ $3.50 USD) is tuned for India — too cheap for Western markets?
4. Any obvious security issues in the self-hosting setup?

Source is Apache 2.0. PRs welcome — especially for: DIKSHA/NPTEL integration, better offline sync, WebRTC live sessions.

Thanks for reading.

— ANKR Labs team, Gurgaon, India

---

## HN Comment Responses (pre-drafted for common questions)

**"Why not just use Notion + Anki?"**
> The friction of switching between apps during a study session is real. More importantly, the `.ib` format lets you create once and distribute everywhere — a teacher can author a bundle with flashcards, quizzes, AI character, and comics, then students download the `.ib` file and learn offline on mobile. Notion can't do that.

**"What's the AI actually doing?"**
> Three things: (1) AI Tutor — answers questions about your notes using RAG over your vault, (2) Bundle generator — takes a PDF/YouTube transcript and generates a full .ib bundle (chapters, flashcards, quiz, character, social posts), (3) Character system — generates personality, catchphrases, and SVG sprite states for a cartoon teacher. All via Anthropic API with BYOK support.

**"Is this production-ready?"**
> We use it internally for training 200+ drivers and freight operators. The core editor and classroom features are stable. The AI Studio features (social factory, comic generator, podcast analyzer) are newer — treat them as beta.

**"Why India-specific pricing?"**
> We're an Indian startup building for Indian users first. The cloud tier pricing reflects Indian purchasing power parity. If there's international demand, we'll add regional pricing.

**"Self-hosting instructions?"**
> `git clone https://github.com/ankr-labs/ankr-interact && docker compose up` — takes about 2 minutes including DB migrations. Full guide at `SELF_HOSTING.md`. Requires: Docker, 2GB RAM, PostgreSQL (included in compose). Optional: Anthropic API key for AI features.
