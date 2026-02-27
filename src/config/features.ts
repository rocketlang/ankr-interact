/**
 * ANKR Interact — Feature Gate Configuration
 *
 * OSS_CORE: included in Apache 2.0 OSS build — always available
 * FREEMIUM:  requires ANKR Cloud account or self-hosted AI/sync setup
 * ENTERPRISE: requires Enterprise license
 *
 * Override any flag via environment variable: FEATURE_<FLAG_NAME>=true/false
 */

export type Tier = 'oss' | 'freemium' | 'enterprise';

export interface Feature {
  enabled: boolean;
  tier: Tier;
  description: string;
}

function env(name: string, fallback: boolean): boolean {
  const val = process.env[`FEATURE_${name}`];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

export const FEATURES = {
  // ── OSS Core (Apache 2.0) ─────────────────────────────────────────────────

  KNOWLEDGE_GRAPH: {
    enabled: env('KNOWLEDGE_GRAPH', true),
    tier: 'oss',
    description: 'D3.js knowledge graph, wiki-links, backlinks',
  },
  BLOCK_EDITOR: {
    enabled: env('BLOCK_EDITOR', true),
    tier: 'oss',
    description: 'Tiptap rich block editor with all extensions',
  },
  CANVAS: {
    enabled: env('CANVAS', true),
    tier: 'oss',
    description: 'Excalidraw whiteboard with local save',
  },
  SEARCH: {
    enabled: env('SEARCH', true),
    tier: 'oss',
    description: 'Full-text search across vault',
  },
  FLASHCARDS: {
    enabled: env('FLASHCARDS', true),
    tier: 'oss',
    description: 'Spaced repetition flashcard system (SM-2)',
  },
  ASSESSMENT: {
    enabled: env('ASSESSMENT', true),
    tier: 'oss',
    description: 'Quiz creation, MCQ, basic grading',
  },
  CLASSROOM: {
    enabled: env('CLASSROOM', true),
    tier: 'oss',
    description: 'Classrooms, assignments, attendance',
  },
  GAMIFICATION: {
    enabled: env('GAMIFICATION', true),
    tier: 'oss',
    description: 'XP, badges, leaderboards, streaks',
  },
  BUNDLE_EXPORT: {
    enabled: env('BUNDLE_EXPORT', true),
    tier: 'oss',
    description: 'Export vault subset as .ib bundle',
  },
  BUNDLE_IMPORT: {
    enabled: env('BUNDLE_IMPORT', true),
    tier: 'oss',
    description: 'Import .ib bundle into vault',
  },
  BUNDLE_PLAYER: {
    enabled: env('BUNDLE_PLAYER', true),
    tier: 'oss',
    description: 'Linear bundle player / course reader',
  },
  PDF_PARSE: {
    enabled: env('PDF_PARSE', true),
    tier: 'oss',
    description: 'PDF text extraction and import',
  },
  MULTILINGUAL_UI: {
    enabled: env('MULTILINGUAL_UI', true),
    tier: 'oss',
    description: '23-language UI with RTL support',
  },
  PUBLIC_PORTAL: {
    enabled: env('PUBLIC_PORTAL', true),
    tier: 'oss',
    description: 'Publish documents to public URL',
  },
  OFFLINE_MODE: {
    enabled: env('OFFLINE_MODE', true),
    tier: 'oss',
    description: 'PWA offline support, local SQLite on mobile',
  },
  VOICE_INPUT: {
    enabled: env('VOICE_INPUT', true),
    tier: 'oss',
    description: 'Browser WebSpeech STT voice input',
  },
  OCR: {
    enabled: env('OCR', true),
    tier: 'oss',
    description: 'Tesseract image text recognition',
  },
  TASKS_KANBAN: {
    enabled: env('TASKS_KANBAN', true),
    tier: 'oss',
    description: 'Task management with Kanban board',
  },

  // ── Freemium (Cloud or self-hosted AI/sync required) ─────────────────────

  COLLAB_REALTIME: {
    enabled: env('COLLAB', !!process.env.AI_PROXY_URL),
    tier: 'freemium',
    description: 'Yjs real-time collaboration, live cursors',
  },
  SEMANTIC_SEARCH: {
    enabled: env('SEMANTIC_SEARCH', !!process.env.AI_PROXY_URL),
    tier: 'freemium',
    description: 'Vector embedding search (requires AI proxy)',
  },
  AI_TUTOR: {
    enabled: env('AI_TUTOR', !!process.env.AI_API_KEY || !!process.env.AI_PROXY_URL),
    tier: 'freemium',
    description: 'AI tutoring with Socratic method (requires AI key)',
  },
  NOTEBOOK_QA: {
    enabled: env('NOTEBOOK_QA', !!process.env.AI_API_KEY || !!process.env.AI_PROXY_URL),
    tier: 'freemium',
    description: 'NotebookLM-style AI chat over documents',
  },
  AI_GRADING: {
    enabled: env('AI_GRADING', !!process.env.AI_API_KEY || !!process.env.AI_PROXY_URL),
    tier: 'freemium',
    description: 'AI subjective answer grading',
  },
  AI_FLASHCARD_GEN: {
    enabled: env('AI_FLASHCARD_GEN', !!process.env.AI_API_KEY || !!process.env.AI_PROXY_URL),
    tier: 'freemium',
    description: 'Auto-generate flashcards from documents',
  },
  CLOUD_SYNC: {
    enabled: env('CLOUD_SYNC', false),
    tier: 'freemium',
    description: 'SQLite ↔ PostgreSQL EON sync engine',
  },
  MARKETPLACE: {
    enabled: env('MARKETPLACE', false),
    tier: 'freemium',
    description: 'Bundle marketplace: browse, purchase, publish',
  },
  PAYMENT: {
    enabled: env('PAYMENT', !!(process.env.RAZORPAY_KEY_ID || process.env.STRIPE_SECRET_KEY)),
    tier: 'freemium',
    description: 'Razorpay + Stripe payment integration',
  },
  PUSH_NOTIFICATIONS: {
    enabled: env('PUSH_NOTIFICATIONS', false),
    tier: 'freemium',
    description: 'Mobile push notifications for flashcards, assignments',
  },

  // ── Enterprise ────────────────────────────────────────────────────────────

  SSO: {
    enabled: env('SSO', false),
    tier: 'enterprise',
    description: 'SAML + OAuth SSO integration',
  },
  AUDIT_LOG: {
    enabled: env('AUDIT_LOG', false),
    tier: 'enterprise',
    description: 'Full audit trail for compliance',
  },
  ENCRYPTION: {
    enabled: env('ENCRYPTION', false),
    tier: 'enterprise',
    description: 'End-to-end encryption of vault content',
  },
  MULTI_TENANCY: {
    enabled: env('MULTI_TENANCY', false),
    tier: 'enterprise',
    description: 'Isolated workspaces per organization',
  },
  WHITE_LABEL: {
    enabled: env('WHITE_LABEL', false),
    tier: 'enterprise',
    description: 'Custom branding, domain, and logo',
  },
  GDPR_TOOLS: {
    enabled: env('GDPR_TOOLS', false),
    tier: 'enterprise',
    description: 'Data export, erasure, retention policies',
  },
} as const satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;

export function isEnabled(feature: FeatureKey): boolean {
  return FEATURES[feature].enabled;
}

export function requireFeature(feature: FeatureKey): void {
  if (!isEnabled(feature)) {
    const f = FEATURES[feature];
    throw new Error(
      `Feature "${feature}" (${f.tier}) is not enabled. ` +
      (f.tier === 'oss' ? 'Check your configuration.' :
       f.tier === 'freemium' ? 'Set up AI proxy or sign up at interact.ankrlabs.in.' :
       'Requires an Enterprise license.'),
    );
  }
}
