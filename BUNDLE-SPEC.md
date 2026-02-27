# ANKR Interact Bundle Specification
## .ib Format — Version 1.0

**Date:** 2026-02-27
**Status:** Stable

---

## Overview

An **Interact Bundle** (`.ib`) is a portable, self-contained knowledge package that can be created on any ANKR Interact instance and imported/played on any other — including the mobile app with no network connection.

A `.ib` file is a **ZIP archive** with a defined internal layout and a signed `manifest.json`.

---

## File Structure

```
bundle.ib   (ZIP archive, UTF-8 filenames)
│
├── manifest.json          ← REQUIRED — bundle metadata + integrity
│
├── docs/                  ← markdown documents
│   ├── chapter-01.md
│   ├── chapter-02.md
│   └── ...
│
├── assets/                ← images, PDFs, audio referenced by docs
│   ├── diagram-01.png
│   └── lecture-notes.pdf
│
├── quizzes/               ← assessment definitions
│   └── quiz-01.json
│
├── flashcards/            ← spaced repetition decks
│   └── deck-01.json
│
├── courses/               ← structured learning paths
│   └── course.json
│
└── canvas/                ← Excalidraw whiteboard snapshots
    └── board-01.excalidraw
```

---

## manifest.json Schema

```json
{
  "spec": "1.0",
  "id": "bundle_<uuid-v4>",
  "name": "NCERT Class 10 Science — Chapter 1",
  "slug": "ncert-class10-science-ch1",
  "version": "1.0.0",
  "description": "Complete study bundle with notes, flashcards, and quiz.",
  "author": {
    "name": "ANKR Labs",
    "email": "hello@ankrlabs.in",
    "url": "https://ankrlabs.in"
  },
  "created_at": "2026-02-27T06:30:00.000Z",
  "updated_at": "2026-02-27T06:30:00.000Z",
  "language": "en",
  "languages": ["en", "hi"],
  "subject": "Science",
  "level": "class-10",
  "tags": ["ncert", "science", "class-10", "chemistry"],
  "access": "public",
  "price": 0,
  "currency": "INR",
  "license": "CC-BY-4.0",
  "ankr_interact_version": "1.0.0",
  "contents": {
    "docs": ["docs/chapter-01.md", "docs/chapter-02.md"],
    "assets": ["assets/diagram-01.png"],
    "quizzes": ["quizzes/quiz-01.json"],
    "flashcards": ["flashcards/deck-01.json"],
    "courses": ["courses/course.json"],
    "canvas": ["canvas/board-01.excalidraw"]
  },
  "entry": "courses/course.json",
  "integrity": {
    "algorithm": "sha256",
    "files": {
      "docs/chapter-01.md": "abc123...",
      "quizzes/quiz-01.json": "def456..."
    },
    "manifest_hash": "ghi789..."
  },
  "signature": {
    "algorithm": "hmac-sha256",
    "value": "jkl012...",
    "signed_at": "2026-02-27T06:30:00.000Z"
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec` | string | ✅ | Always `"1.0"` for this version |
| `id` | string | ✅ | `bundle_` + UUID v4, unique per bundle |
| `name` | string | ✅ | Human-readable title (max 200 chars) |
| `slug` | string | ✅ | URL-safe identifier (lowercase, hyphens) |
| `version` | string | ✅ | Semver — author-managed |
| `description` | string | ✅ | Summary (max 2000 chars) |
| `author.name` | string | ✅ | Creator name |
| `author.email` | string | — | Creator email |
| `language` | string | ✅ | Primary language (BCP 47: `en`, `hi`, `ta`) |
| `languages` | string[] | — | All languages present |
| `subject` | string | — | Subject area |
| `level` | string | — | Target level (e.g. `class-10`, `undergraduate`) |
| `tags` | string[] | — | Discovery tags (max 20, max 50 chars each) |
| `access` | enum | ✅ | `public` \| `free` \| `premium` \| `private` |
| `price` | number | — | Price in `currency` (0 = free) |
| `license` | string | ✅ | SPDX identifier or custom string |
| `entry` | string | — | Preferred entry point (course or first doc) |
| `contents` | object | ✅ | File lists by type |
| `integrity` | object | ✅ | SHA-256 hashes of all files |
| `signature` | object | — | HMAC-SHA256 signature (signed bundles only) |

---

## docs/ — Markdown Documents

Standard CommonMark markdown. Extensions supported:

- **Wiki-links:** `[[Document Title]]` or `[[slug|Display Text]]`
- **Asset refs:** `![alt](../assets/image.png)` (relative to bundle root)
- **Frontmatter:** YAML between `---` delimiters

### Frontmatter

```yaml
---
title: Chapter 1 — Chemical Reactions
order: 1
tags: [chemistry, reactions]
estimated_minutes: 20
---
```

---

## quizzes/ — Quiz JSON

```json
{
  "id": "quiz-01",
  "title": "Chapter 1 Quiz",
  "doc_ref": "docs/chapter-01.md",
  "time_limit_minutes": 15,
  "passing_score": 60,
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "text": "What is a chemical equation?",
      "options": [
        { "id": "a", "text": "A symbolic representation of a chemical reaction" },
        { "id": "b", "text": "A list of chemicals" },
        { "id": "c", "text": "A mathematical formula" },
        { "id": "d", "text": "None of the above" }
      ],
      "correct": "a",
      "explanation": "A chemical equation uses symbols to represent reactants and products."
    },
    {
      "id": "q2",
      "type": "true_false",
      "text": "Combustion is always an exothermic reaction.",
      "correct": true,
      "explanation": "Combustion releases energy as heat and light."
    },
    {
      "id": "q3",
      "type": "short_answer",
      "text": "Define electrolysis.",
      "sample_answer": "Electrolysis is the decomposition of a compound by passing electric current.",
      "grading": "ai"
    }
  ]
}
```

**Question types:** `mcq` | `true_false` | `short_answer` | `fill_blank` | `match`

---

## flashcards/ — Spaced Repetition Deck

```json
{
  "id": "deck-01",
  "name": "Chemical Reactions Key Terms",
  "doc_ref": "docs/chapter-01.md",
  "algorithm": "sm2",
  "cards": [
    {
      "id": "card-001",
      "front": "What is a reactant?",
      "back": "A substance that participates in a chemical reaction and is changed by it.",
      "tags": ["vocabulary"],
      "image": "../assets/reactant-diagram.png"
    }
  ]
}
```

---

## courses/ — Learning Path

```json
{
  "id": "course-01",
  "title": "Class 10 Science — Chemical Reactions",
  "estimated_hours": 4,
  "modules": [
    {
      "id": "mod-01",
      "title": "Introduction",
      "type": "doc",
      "ref": "docs/chapter-01.md",
      "estimated_minutes": 20,
      "required": true
    },
    {
      "id": "mod-02",
      "title": "Chapter Quiz",
      "type": "quiz",
      "ref": "quizzes/quiz-01.json",
      "min_score": 60,
      "required": true,
      "unlocks_after": ["mod-01"]
    },
    {
      "id": "mod-03",
      "title": "Flashcard Review",
      "type": "flashcards",
      "ref": "flashcards/deck-01.json",
      "required": false
    }
  ]
}
```

**Module types:** `doc` | `quiz` | `flashcards` | `canvas` | `video` | `external_link`

---

## canvas/ — Excalidraw Snapshots

Standard Excalidraw JSON format (`.excalidraw` extension).

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [...],
  "appState": {...},
  "files": {}
}
```

---

## Integrity & Signing

### Integrity (always present)

Every file in the bundle gets a SHA-256 hash in `manifest.integrity.files`. The manifest itself gets hashed (excluding the `integrity.manifest_hash` field) and stored in `integrity.manifest_hash`.

Validation on import:
1. Compute SHA-256 of each file → compare with `integrity.files`
2. Compute SHA-256 of manifest (without `manifest_hash`) → compare with `integrity.manifest_hash`
3. Any mismatch → reject import with `BUNDLE_TAMPERED` error

### Signature (optional — signed bundles)

Signed bundles include an HMAC-SHA256 signature over the `manifest_hash` using a server-held secret. The signature proves the bundle was authored by a specific ANKR Interact instance.

---

## Access Control

| `access` value | Who can open | Requires |
|---------------|-------------|---------|
| `public` | Anyone, no auth | Nothing |
| `free` | Anyone with link | Nothing |
| `premium` | Paid users | Purchase record or token |
| `private` | Password holders | Bundle password |

---

## Size Limits

| Component | Limit |
|-----------|-------|
| Total bundle size | 500 MB |
| Individual asset | 100 MB |
| Number of docs | 1,000 |
| Number of quiz questions | 10,000 |
| Number of flashcards | 50,000 |

---

## Versioning

The spec version (`manifest.spec`) follows semver. Breaking changes increment the major version. Importers MUST reject bundles with an unsupported major version. Minor/patch versions are backwards-compatible.

| Spec | Status | Notes |
|------|--------|-------|
| `1.0` | ✅ Current | Initial release |

---

## MIME Type & Extension

- **File extension:** `.ib`
- **MIME type:** `application/x-interact-bundle`
- **Deep link:** `ankrinteract://import?url=<encoded-url>`

---

*ANKR Labs — Gurgaon | Apache 2.0*
