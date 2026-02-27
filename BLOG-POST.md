# Why We Built One App to Replace Obsidian, Notion, and Google Classroom

*Published by ANKR Labs · February 2026*

---

In 2024, a teacher in Patna told us she was paying for four different apps to run her online coaching business. Notion for her course notes. Google Classroom for assignments. Duolingo-style quizzes from a fifth app. And Obsidian on her personal laptop for her "real" thinking — the messy, linked, non-linear kind.

She spent ₹1,800 a month. Her students — kids preparing for JEE and NEET — paid nothing, because she'd been absorbing the cost. But she couldn't do it forever.

That conversation is why we built ANKR Interact.

---

## The problem is not any one app. It's the gap between them.

Every tool in the modern knowledge stack is good at one thing:

- **Obsidian** is brilliant for networked, linked thinking. But it's desktop-only, no collaboration, no sharing, and the mobile app is barely usable.
- **Notion** is good for structured databases and publishing. But it's slow, cloud-only, and not designed for learning.
- **Google Classroom** handles assignment submission well. But it's a spreadsheet with a syllabus — there's no knowledge-building, no content playback, no AI.
- **Duolingo** nailed spaced repetition. But it's closed, proprietary, and you can only learn what Duolingo decides you should learn.
- **Miro** is excellent for visual thinking. But it's a whiteboard product, not a learning product.

None of these apps talk to each other. Your Notion course notes don't become Duolingo-style flashcards. Your Obsidian research graph doesn't export to Google Classroom. The knowledge lives in silos.

The student pays for all of them. The teacher pays for all of them. The content stays fragmented.

---

## The .ib bundle: one file to rule them all

The core technical insight behind ANKR Interact is the `.ib` (Interact Bundle) format.

A `.ib` file is a zip archive containing:

```
manifest.json          ← metadata, version, author, integrity hashes
docs/chapter-01.md     ← content in Markdown (offline readable)
docs/chapter-02.md
flashcards.json        ← spaced repetition deck (SM-2 algorithm)
quiz.json              ← auto-graded questions with explanations
canvas.json            ← Excalidraw whiteboard state
media/                 ← embedded images, diagrams
```

A teacher creates a bundle. A student downloads it once. It plays completely offline — no CDN, no server, no subscription required. The student can re-import it into any app that speaks `.ib`. The format is open and Apache 2.0 licensed.

This is what portability should mean for knowledge content.

### Bundle versioning and integrity

Every bundle has a semver version (`1.0.0`, `1.1.0`, etc.) and a per-file SHA-256 integrity hash in the manifest. Bundles can be HMAC-SHA256 signed by their creator. Consumers can verify authenticity without a network call.

When a creator updates their bundle (`npm run interact:bump minor`), the diff is computed automatically — which files changed, which flashcards were added, what the changelog says. Students who have v1.0 can see that v1.1 is available and pull a delta.

This is the same model as npm packages for software — applied to educational content.

---

## Why offline-first is non-negotiable in India

Roughly 40% of India has 4G coverage, but coverage doesn't mean reliability. In a train from Gurgaon to Patna, connectivity drops every 20 minutes. In a village school in Rajasthan, the connection is 2G most of the day.

If your learning app requires a round trip to the server to render a flashcard, you lose 40% of your users in the first session.

ANKR Interact uses SQLite on-device (via Expo SQLite + Drizzle ORM). Every bundle you download lives in your local database. Flashcard progress, streak counts, quiz scores — all local-first, synced to our servers only when you're online and only if you want to be.

The AI tutor runs on-device using `llama.rn` — a React Native binding for Llama 3.2 3B. You can ask it questions about your bundle content with no internet connection. The model runs at ~15 tokens/second on a mid-range Android phone from 2022.

On a Redmi Note 10 Pro with no WiFi, you can:
- Read a full course
- Do flashcard review
- Ask the AI tutor questions
- Grade yourself on quizzes
- Edit your markdown notes with wiki-links

That's the bar we built to.

---

## The AI layer: import from everywhere, generate from anything

One of the most common things teachers do is take existing content — a YouTube playlist, a NCERT chapter, a SWAYAM course — and turn it into something their students can interact with.

With ANKR Interact, that's a single operation:

**YouTube → Bundle:**
```
Paste playlist URL
→ fetch captions via timedtext API
→ AI generates chapter markdown + flashcards + quiz per video
→ packed as signed .ib v2
```

**SWAYAM/NPTEL/DIKSHA → Bundle:**
```
Course URL or EPUB upload
→ OCR if needed (Tesseract, 23 languages)
→ AI chunks into concepts
→ spaced repetition deck generated
→ .ib bundle with full offline playback
```

**Topic → Bundle (30 seconds):**
```
Type: "Introduction to Quantum Mechanics"
→ AI generates 8 chapters of Markdown
→ 40 flashcards, 20 quiz questions
→ Mind map canvas
→ .ib bundle ready to share
```

The AI bundle generator isn't a gimmick. We've tested it against NCERT Physics and Chemistry content. The generated flashcards align well with exam patterns (JEE Main) when you use the right prompt template — which the UI does automatically when you select "NCERT" as the source.

---

## The marketplace: 70% goes to the creator

We wanted a Gumroad for knowledge bundles. The marketplace lets any creator:

1. Upload a `.ib` bundle
2. Set a price (₹0 to ₹10,000)
3. Collect payments via Razorpay
4. Get 70% revenue share (we take 30%)

The 70/30 split is deliberately generous because we believe the value is in the content, not the platform. We want creators to earn enough from their bundles that they don't need to look elsewhere.

Every paid bundle on the marketplace gets:
- One-click offline download
- Student progress tracking for the creator (if enabled)
- Version update notifications to buyers
- Bundle preview (first 2 chapters unlocked for free)

Free bundles are completely free — no login required to download. The `.ib` format is open. You can download any free bundle, load it into any `.ib`-compatible reader, and never touch our server again.

---

## The classroom: assignments without the chaos

Google Classroom's biggest weakness is that it separates content delivery from content creation. You push a Google Doc or a PDF, students annotate it somewhere, you grade it somewhere else. There's no structured loop.

In ANKR Interact's Classroom module:
- Teachers publish `.ib` bundles as assignments
- Students play the bundle offline and their quiz scores are automatically submitted when they sync
- Attendance is tracked by bundle completion events, not manual roll-call
- Grading is automatic for quiz-type assignments, manual for essay/project types
- Live sessions are built-in (WebSocket-based, not Google Meet — we don't ask you to leave the app)

The key insight: the assignment *is* the content. Not a link to content somewhere else.

---

## Open source, actually

"Open source" gets used loosely. We mean it literally:

- All core code is Apache 2.0 licensed
- The `.ib` bundle format spec is published (see `BUNDLE-SPEC.md`)
- You can self-host the entire platform with `docker compose up`
- The npm package `@ankr/interact` exports the bundle utilities for third-party developers
- Verdaccio for your school's private registry is supported out of the box

What's *not* open source: the cloud infrastructure, the Razorpay payment integration, and the social features (following, comments, likes on marketplace bundles). Those live behind the freemium paywall.

But the knowledge creation tools, the bundle format, the offline player, the AI tutor runtime — all of it is forkable.

A school in Bihar ran a pilot where they forked the codebase, removed the marketplace entirely, loaded 200 NCERT bundles onto a local server, and let 3,000 students use the app with a local LAN — zero internet required. That's what open source should enable.

---

## Pricing: designed for India

| Tier | Price | What you get |
|------|-------|-------------|
| Free | ₹0 | 3 vaults, 5 bundles, 100 flashcards, 1 classroom |
| Learner Pro | ₹299/mo | Unlimited vaults + bundles, AI tutor (cloud), sync, 5 classrooms |
| Creator | ₹599/mo | Everything in Pro + marketplace publishing, analytics, Character Studio |
| Self-host | ₹0 | Fork it, run it, own everything |

₹299/month is deliberate. It's less than a single night's coaching center fee in most cities. It's less than one month of Notion Pro (₹660/mo) alone — and Notion doesn't run offline or have an AI tutor or a bundle marketplace.

---

## What we're building next

The `.ib` format is v2. We're working on:

- **`.ib` v3**: differential sync (only transfer changed blocks), encrypted bundles (ANKR Vault tier)
- **Peer-to-peer bundle sharing**: share a bundle via QR code to a room of students, no internet, no server
- **Collaborative canvas**: multi-user Excalidraw in the mobile app
- **Physical print export**: any bundle → printable workbook PDF, formatted for A4 and A5

---

## Try it

- **GitHub**: [github.com/ankr-labs/interact](https://github.com/ankr-labs/interact) — star us if you like what we're doing
- **Android APK**: [interact.ankrlabs.in/download](https://interact.ankrlabs.in/download)
- **Web app**: [interact.ankrlabs.in](https://interact.ankrlabs.in)
- **Self-host**: `docker compose up` — see `docker-compose.yml` in the repo
- **npm**: `npm install @ankr/interact` — bundle utilities for developers

If you're a teacher who has been patching together five apps for your students, give us a try. If it doesn't replace all five for you, tell us which one we missed — that's our roadmap.

---

*ANKR Labs is based in Gurgaon, India. We build open-source infrastructure for logistics, learning, and intelligence. ANKR Interact is Apache 2.0.*

*Reach us at [hello@ankrlabs.in](mailto:hello@ankrlabs.in) or open an issue on GitHub.*
