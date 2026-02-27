# ANKR Interact Bundle Format v2 (`.ib`)

**Version:** 2.0
**Date:** 2026-02-27
**Backward-compatible with v1**

---

## Directory Structure

```
my-bundle.ib/
├── manifest.json          # REQUIRED — bundle metadata + version + type flags
├── docs/                  # Markdown content chapters
│   ├── chapter-1.md
│   └── chapter-2.md
├── flashcards/
│   └── deck.json          # SM-2 flashcard deck
├── quizzes/
│   └── assessment.json    # MCQ quiz questions
├── courses/
│   └── main.json          # Course structure (modules, lessons)
│
│── ── NEW IN v2 ────────────────────────────────────────────
│
├── characters/            # AI character specs (cartoon teachers, narrators)
│   ├── character.json     # Character definition (name, style, voice, expressions)
│   └── sprites/           # SVG sprite sheets (idle, talk, explain, celebrate)
│       ├── idle.svg
│       ├── talking.svg
│       ├── explaining.svg
│       └── celebrating.svg
│
├── audio/                 # Podcast / narration audio
│   ├── intro.mp3
│   ├── chapter-1-narration.mp3
│   └── podcast-episode.mp3
│
├── comics/                # Comic strip panels
│   └── strips/
│       ├── strip-01.json  # Panel script (dialogue, action, character refs)
│       └── strip-01-panels/
│           ├── panel-1.png
│           └── panel-2.png
│
├── social/                # Social media + newsletter content
│   ├── newsletter.md      # Full newsletter issue
│   ├── linkedin.md        # LinkedIn post (1300 char)
│   ├── twitter.md         # Twitter thread (280×N chars)
│   ├── whatsapp.md        # WhatsApp message (short + link)
│   └── instagram.md       # Instagram caption + hashtags
│
└── vault/                 # Original source files (preserved as-is)
    ├── source.pdf
    ├── source.docx
    └── source.mp4
```

---

## manifest.json v2

```json
{
  "version": 2,
  "slug": "physics-optics-class12",
  "name": "Optics — Class 12 Physics",
  "description": "Complete guide to light, lenses, and optics",
  "subject": "Physics",
  "language": "en",
  "level": "class12",
  "createdAt": "2026-02-27T10:00:00Z",
  "creator": { "name": "Priya Sharma", "id": "user-123" },

  "features": {
    "docs": true,
    "flashcards": true,
    "quiz": true,
    "courses": true,
    "character": true,
    "audio": true,
    "comics": true,
    "social": true,
    "vault": true
  },

  "character": {
    "name": "Aria",
    "style": "anime",
    "voice": "female-hindi-en",
    "primaryColor": "#6366f1"
  },

  "audio": {
    "type": "podcast",
    "episodes": [
      { "file": "audio/podcast-episode.mp3", "title": "Optics Explained", "duration": 1240 }
    ]
  },

  "comics": {
    "strips": ["comics/strips/strip-01.json"]
  },

  "social": {
    "newsletter": "social/newsletter.md",
    "linkedin": "social/linkedin.md",
    "twitter": "social/twitter.md"
  },

  "stats": {
    "chapters": 5,
    "flashcardCount": 25,
    "quizCount": 15,
    "comicStrips": 3,
    "audioMinutes": 20
  }
}
```

---

## character.json

```json
{
  "id": "aria",
  "name": "Aria",
  "style": "anime",
  "personality": "enthusiastic, patient, uses analogies",
  "voice": {
    "provider": "tts",
    "lang": "en-IN",
    "pitch": 1.1,
    "rate": 0.95
  },
  "sprites": {
    "idle": "sprites/idle.svg",
    "talking": "sprites/talking.svg",
    "explaining": "sprites/explaining.svg",
    "celebrating": "sprites/celebrating.svg",
    "thinking": "sprites/thinking.svg"
  },
  "primaryColor": "#6366f1",
  "accentColor": "#f59e0b",
  "catchphrases": [
    "Great question!",
    "Let me explain with an example...",
    "You've got this!"
  ]
}
```

---

## Comic Strip JSON (`strips/strip-01.json`)

```json
{
  "id": "strip-01",
  "title": "How Light Bends",
  "panels": [
    {
      "id": "p1",
      "character": "aria",
      "expression": "explaining",
      "dialogue": "Light travels in straight lines... until it hits something!",
      "backgroundDescription": "Bright classroom, sunlight streaming through window",
      "action": "Points at a ray diagram on a whiteboard"
    },
    {
      "id": "p2",
      "character": "aria",
      "expression": "celebrating",
      "dialogue": "That's refraction — light bending as it changes medium!",
      "backgroundDescription": "Zoom in on whiteboard showing Snell's Law",
      "action": "Gives thumbs up"
    }
  ]
}
```

---

## Migration from v1

v1 bundles remain fully compatible. The v2 player checks `manifest.version`:
- `undefined` or `1` → v1 mode (docs + flashcards + quiz only)
- `2` → v2 mode (all features enabled based on `features` flags)

---

## Bundle Player v2 Features

| Feature | v1 | v2 |
|---------|----|----|
| Markdown docs | ✅ | ✅ |
| Flashcards (SM-2) | ✅ | ✅ |
| MCQ Quiz | ✅ | ✅ |
| Course view | ✅ | ✅ |
| AI Character tutor | — | ✅ |
| Audio narration / podcast | — | ✅ |
| Comic strips | — | ✅ |
| Social content view | — | ✅ |
| Source vault files | — | ✅ |
