#!/usr/bin/env tsx
/**
 * ANKR Interact — Demo Seed Script
 *
 * Populates a fresh database with demo data so you can explore
 * the platform without uploading your own documents.
 *
 * Usage:
 *   pnpm run seed:demo
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ANKR Interact demo data...\n');

  // ── Demo user ──────────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'demo@ankrinteract.local' },
    update: {},
    create: {
      email: 'demo@ankrinteract.local',
      name: 'Demo User',
      role: 'admin',
      passwordHash: crypto.createHash('sha256').update('demo1234').digest('hex'),
    },
  });
  console.log(`✓ User: ${user.email}`);

  // ── Demo documents ─────────────────────────────────────────────────────────
  const docs = [
    {
      title: 'Welcome to ANKR Interact',
      slug: 'welcome',
      content: `# Welcome to ANKR Interact

This is your knowledge OS — a single app that replaces:

- **Obsidian** — knowledge graph, wiki-links, backlinks
- **Notion** — block editor, databases, kanban
- **NotebookLM** — AI chat over your documents
- **Google Classroom** — LMS, assignments, grading
- **Duolingo** — spaced repetition, gamification
- **Miro** — whiteboard and collaboration

## Getting Started

1. [[Import your documents]] from PDF, markdown, or the web
2. [[Create your first bundle]] to share with others
3. [[Set up a classroom]] if you're an educator
4. Explore the [[Knowledge Graph]] to see connections

> Tip: Type \`[[\` anywhere to create a wiki-link between documents.
`,
      tags: ['getting-started', 'guide'],
    },
    {
      title: 'The .ib Bundle Format',
      slug: 'bundle-format',
      content: `# The .ib Bundle Format

An **Interact Bundle** (\`.ib\`) is a portable knowledge package.

## Structure

\`\`\`
bundle.ib  (zip archive)
├── manifest.json     # metadata, author, license
├── docs/             # markdown documents
├── quizzes/          # assessment JSON
├── flashcards/       # spaced repetition decks
├── courses/          # learning path definition
└── canvas/           # whiteboard snapshots
\`\`\`

## Use Cases

- **Teacher** shares a lesson bundle → students import and learn offline
- **Author** publishes a book bundle → readers buy on marketplace
- **Company** distributes onboarding bundle → employees complete it on mobile

## Related

- [[Welcome to ANKR Interact]]
- [[Create your first bundle]]
`,
      tags: ['bundles', 'format', 'guide'],
    },
    {
      title: 'Create Your First Bundle',
      slug: 'create-first-bundle',
      content: `# Create Your First Bundle

## Step 1 — Select documents

Go to **Documents** → select the docs you want to include → click **Export as Bundle**.

## Step 2 — Add assessments (optional)

In the bundle export dialog, choose quizzes and flashcard decks to include.

## Step 3 — Set access

| Access | Who can open it |
|--------|----------------|
| Public | Anyone |
| Free | Anyone with link |
| Premium | Paid access only |
| Private | Password protected |

## Step 4 — Share

- Download the \`.ib\` file and share via WhatsApp, email, or link
- Upload to the [[Marketplace]] for others to discover
- Generate a **QR code** for offline sharing

## Related

- [[The .ib Bundle Format]]
- [[Welcome to ANKR Interact]]
`,
      tags: ['bundles', 'guide'],
    },
  ];

  for (const doc of docs) {
    const created = await prisma.document.upsert({
      where: { slug: doc.slug },
      update: { content: doc.content },
      create: {
        title: doc.title,
        slug: doc.slug,
        content: doc.content,
        path: `demo/${doc.slug}.md`,
        userId: user.id,
      },
    });
    console.log(`✓ Document: ${doc.title}`);
  }

  // ── Demo flashcard deck ────────────────────────────────────────────────────
  const deck = await prisma.flashcardDeck?.create?.({
    data: {
      name: 'ANKR Interact Concepts',
      userId: user.id,
      cards: {
        create: [
          { front: 'What is an .ib bundle?', back: 'A portable zip archive containing docs, quizzes, flashcards, and courses.' },
          { front: 'Which editor does ANKR Interact use?', back: 'Tiptap — a rich block editor with LaTeX math, Mermaid diagrams, Kanban, and more.' },
          { front: 'What is the sync target for cloud mode?', back: 'ankr-eon — a PostgreSQL instance with delta sync and vector clocks.' },
          { front: 'How many languages does ANKR Interact support?', back: '23 languages including all major Indian languages, Arabic, Thai, and Vietnamese.' },
          { front: 'What is the OSS license?', back: 'Apache 2.0 — the OSS core is free forever and self-hostable.' },
        ],
      },
    },
  }).catch(() => null);  // skip if flashcard tables don't exist yet

  if (deck) console.log(`✓ Flashcard deck: ANKR Interact Concepts (5 cards)`);

  // ── Demo classroom ─────────────────────────────────────────────────────────
  const classroom = await prisma.classroom?.create?.({
    data: {
      name: 'Demo Classroom',
      subject: 'Knowledge Management',
      teacherId: user.id,
      code: 'DEMO2026',
    },
  }).catch(() => null);

  if (classroom) console.log(`✓ Classroom: Demo Classroom (code: DEMO2026)`);

  console.log('\n✅ Demo seed complete!');
  console.log('   Login: demo@ankrinteract.local / demo1234');
  console.log('   Open:  http://localhost:3199\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
