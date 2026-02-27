/**
 * On-Device AI — Phase F1
 *
 * Priority chain:
 *   1. llama.rn (on-device Llama 3.2 1B) — fully offline
 *   2. Server AI proxy (/api/sync/ai/chat) — when online
 *   3. Graceful fallback message
 *
 * Install llama.rn:  npm install llama.rn
 * Download model:    npx llama-rn download llama3.2-1b-q4
 *
 * Tasks:
 *   - explain(text, context)        → explanation string
 *   - summarize(content)            → summary string
 *   - generateFlashcards(content)  → FlashCard[]
 *   - generateQuiz(content)        → QuizQuestion[]
 *   - chat(messages)               → reply string
 */

import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlashCard {
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
}

export interface QuizOption { id: string; text: string; }
export interface QuizQuestion {
  id: string;
  type: 'mcq';
  text: string;
  options: QuizOption[];
  correct: string;
  explanation?: string;
}

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }

// ─── Llama.rn loader (optional, graceful if not installed) ────────────────────

let llamaContext: any = null;
let llamaLoading = false;

async function getLlamaContext(): Promise<any | null> {
  if (llamaContext) return llamaContext;
  if (llamaLoading) return null;
  llamaLoading = true;
  try {
    const { LlamaContext } = await import('llama.rn' as any);
    // Model is stored at: {documentDirectory}/models/llama3.2-1b-q4.gguf
    // Users download it via the Settings screen
    const { FileSystem } = await import('expo-file-system' as any);
    const modelPath = FileSystem.documentDirectory + 'models/llama3.2-1b-q4.gguf';
    const info = await FileSystem.getInfoAsync(modelPath);
    if (!info.exists) {
      console.log('[OnDeviceAI] Model not downloaded yet');
      llamaLoading = false;
      return null;
    }
    llamaContext = await LlamaContext.create({ model: modelPath, n_ctx: 2048, n_threads: 2 });
    console.log('[OnDeviceAI] Llama context ready');
  } catch (e) {
    console.log('[OnDeviceAI] llama.rn not available:', e);
    llamaContext = null;
  }
  llamaLoading = false;
  return llamaContext;
}

// ─── Server proxy helper ──────────────────────────────────────────────────────

async function getServerConfig(): Promise<{ url: string; token: string } | null> {
  try {
    const urlRow = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all();
    const tokenRow = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'auth_token')).all();
    const url = urlRow[0]?.value;
    if (!url) return null;
    return { url, token: tokenRow[0]?.value ?? '' };
  } catch {
    return null;
  }
}

async function callServerAI(messages: ChatMessage[], serverUrl: string, token: string): Promise<string> {
  const res = await fetch(`${serverUrl}/api/sync/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Server AI error: ${res.status}`);
  const d = await res.json() as any;
  return d.reply ?? '';
}

// ─── On-device inference ──────────────────────────────────────────────────────

async function callOnDevice(prompt: string, system: string): Promise<string | null> {
  const ctx = await getLlamaContext();
  if (!ctx) return null;
  try {
    const fullPrompt = `<|system|>\n${system}\n<|end|>\n<|user|>\n${prompt}\n<|end|>\n<|assistant|>`;
    const result = await ctx.completion({ prompt: fullPrompt, n_predict: 512, temperature: 0.7, stop: ['<|end|>', '<|user|>'] });
    return result.text?.trim() ?? null;
  } catch (e) {
    console.error('[OnDeviceAI] Inference error:', e);
    return null;
  }
}

function parseJSONSafe<T>(text: string, fallback: T): T {
  try {
    const m = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    return JSON.parse(m ? m[1] : text) as T;
  } catch {
    return fallback;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Route a prompt through: on-device → server proxy → fallback message
 */
async function route(prompt: string, system: string, isOnline: boolean): Promise<string> {
  // Try on-device first
  const onDeviceResult = await callOnDevice(prompt, system);
  if (onDeviceResult) return onDeviceResult;

  // Try server proxy
  if (isOnline) {
    const cfg = await getServerConfig();
    if (cfg) {
      try {
        return await callServerAI([
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ], cfg.url, cfg.token);
      } catch { /* fall through */ }
    }
  }

  return '⚠ AI is unavailable. Download the on-device model in Settings, or connect to your ANKR Interact server.';
}

/**
 * Explain selected text with optional document context.
 */
export async function explain(text: string, context: string, isOnline: boolean): Promise<string> {
  const sys = 'You are a knowledgeable teacher. Explain concepts clearly and concisely in 2-3 short paragraphs.';
  const prompt = context
    ? `Context: "${context.slice(0, 400)}"\n\nExplain: "${text}"`
    : `Explain clearly: "${text}"`;
  return route(prompt, sys, isOnline);
}

/**
 * Summarize document content.
 */
export async function summarize(content: string, title: string, isOnline: boolean): Promise<string> {
  const sys = 'You are a skilled summarizer. Create clear, structured bullet-point summaries.';
  const prompt = `Summarize "${title}" in 5-7 bullet points covering the key concepts:\n\n${content.slice(0, 2000)}`;
  return route(prompt, sys, isOnline);
}

/**
 * Generate flashcards from document content (on-device or server).
 */
export async function generateFlashcards(content: string, title: string, count: number, isOnline: boolean): Promise<FlashCard[]> {
  const sys = `You are a spaced repetition expert. Return ONLY a JSON array of flashcards.
Each card: {"front": "Question?", "back": "Answer", "hint": "optional", "tags": ["tag"]}`;
  const prompt = `Generate ${count} flashcards for "${title}":\n\n${content.slice(0, 2000)}\n\nReturn JSON array only.`;

  // Try on-device
  const onDevice = await callOnDevice(prompt, sys);
  if (onDevice) return parseJSONSafe<FlashCard[]>(onDevice, []);

  // Try server endpoint (richer, more reliable)
  if (isOnline) {
    const cfg = await getServerConfig();
    if (cfg) {
      try {
        const res = await fetch(`${cfg.url}/api/ai/generate-flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
          body: JSON.stringify({ content, title, count }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const d = await res.json() as any;
          return d.cards ?? [];
        }
      } catch { /* ok */ }
    }
  }
  return [];
}

/**
 * Generate MCQ quiz questions from document content.
 */
export async function generateQuiz(content: string, title: string, count: number, isOnline: boolean): Promise<QuizQuestion[]> {
  const sys = `You are an exam setter. Return ONLY a JSON array of MCQ questions.
Each: {"id":"q1","type":"mcq","text":"Q?","options":[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}],"correct":"a","explanation":"..."}`;
  const prompt = `Generate ${count} MCQ questions for "${title}":\n\n${content.slice(0, 2000)}\n\nReturn JSON array only.`;

  const onDevice = await callOnDevice(prompt, sys);
  if (onDevice) return parseJSONSafe<QuizQuestion[]>(onDevice, []);

  if (isOnline) {
    const cfg = await getServerConfig();
    if (cfg) {
      try {
        const res = await fetch(`${cfg.url}/api/ai/generate-quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
          body: JSON.stringify({ content, title, count }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const d = await res.json() as any;
          return d.questions ?? [];
        }
      } catch { /* ok */ }
    }
  }
  return [];
}

/**
 * Multi-turn chat routed through on-device or server.
 */
export async function chat(messages: ChatMessage[], isOnline: boolean): Promise<string> {
  // Build flat prompt for on-device
  const sys = messages.find(m => m.role === 'system')?.content ??
    'You are a helpful AI assistant in ANKR Interact.';
  const conversation = messages.filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  const prompt = conversation;

  const onDevice = await callOnDevice(prompt, sys);
  if (onDevice) return onDevice;

  if (isOnline) {
    const cfg = await getServerConfig();
    if (cfg) {
      try { return await callServerAI(messages, cfg.url, cfg.token); } catch { /* ok */ }
    }
  }
  return '⚠ AI is unavailable. Download the on-device model in Settings, or connect to your server.';
}

/**
 * Check if on-device model is available.
 */
export async function isOnDeviceAvailable(): Promise<boolean> {
  const ctx = await getLlamaContext();
  return ctx !== null;
}

/**
 * Check if llama.rn package is installed (vs just model missing).
 */
export async function isLlamaRnInstalled(): Promise<boolean> {
  try {
    await import('llama.rn' as any);
    return true;
  } catch {
    return false;
  }
}
