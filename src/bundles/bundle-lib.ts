/**
 * ANKR Interact — Bundle Library
 * Core .ib bundle pack / unpack / validate / sign / QR
 *
 * Apache 2.0 — ANKR Labs
 */

import JSZip from 'jszip';
import * as crypto from 'crypto';
import { z } from 'zod';

// ── Manifest Schema (Zod) ─────────────────────────────────────────────────────

export const BundleAuthorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

export const BundleIntegritySchema = z.object({
  algorithm: z.literal('sha256'),
  files: z.record(z.string()),
  manifest_hash: z.string(),
});

export const BundleSignatureSchema = z.object({
  algorithm: z.literal('hmac-sha256'),
  value: z.string(),
  signed_at: z.string().datetime(),
});

export const BundleManifestSchema = z.object({
  spec: z.literal('1.0'),
  id: z.string().regex(/^bundle_[0-9a-f-]{36}$/),
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(2000),
  author: BundleAuthorSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  language: z.string().min(2).max(10),
  languages: z.array(z.string()).optional(),
  subject: z.string().optional(),
  level: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  access: z.enum(['public', 'free', 'premium', 'private']),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  license: z.string().min(1),
  ankr_interact_version: z.string(),
  entry: z.string().optional(),
  contents: z.object({
    docs: z.array(z.string()).optional(),
    assets: z.array(z.string()).optional(),
    quizzes: z.array(z.string()).optional(),
    flashcards: z.array(z.string()).optional(),
    courses: z.array(z.string()).optional(),
    canvas: z.array(z.string()).optional(),
  }),
  integrity: BundleIntegritySchema,
  signature: BundleSignatureSchema.optional(),
});

export type BundleManifest = z.infer<typeof BundleManifestSchema>;
export type BundleAuthor = z.infer<typeof BundleAuthorSchema>;

// ── Bundle Contents (in-memory representation) ───────────────────────────────

export interface BundleFile {
  path: string;             // e.g. "docs/chapter-01.md"
  content: Buffer | string;
  mimeType?: string;
}

export interface BundleContents {
  manifest: BundleManifest;
  files: BundleFile[];
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface PackOptions {
  manifest: Omit<BundleManifest, 'integrity' | 'id' | 'created_at' | 'updated_at' | 'spec' | 'ankr_interact_version'> & {
    id?: string;
  };
  files: BundleFile[];
  signKey?: string;   // HMAC key for signing — omit for unsigned bundles
  interactVersion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: BundleManifest;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(data: string, key: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function randomUUID(): string {
  return crypto.randomUUID();
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function bufferOf(content: Buffer | string): Buffer {
  return Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
}

// ── Pack — create a .ib buffer ────────────────────────────────────────────────

export async function packBundle(opts: PackOptions): Promise<Buffer> {
  const zip = new JSZip();
  const now = new Date().toISOString();
  const id = opts.manifest.id ? `bundle_${opts.manifest.id}` : `bundle_${randomUUID()}`;

  // Hash all files
  const fileHashes: Record<string, string> = {};
  for (const f of opts.files) {
    const buf = bufferOf(f.content);
    fileHashes[f.path] = sha256(buf);
    zip.file(f.path, buf);
  }

  // Build manifest (without manifest_hash first)
  const manifestWithoutHash: Omit<BundleManifest, 'integrity'> & { integrity: Omit<BundleManifest['integrity'], 'manifest_hash'> & { manifest_hash: string } } = {
    spec: '1.0',
    id,
    name: opts.manifest.name,
    slug: opts.manifest.slug || toSlug(opts.manifest.name),
    version: opts.manifest.version || '1.0.0',
    description: opts.manifest.description || '',
    author: opts.manifest.author,
    created_at: now,
    updated_at: now,
    language: opts.manifest.language || 'en',
    languages: opts.manifest.languages,
    subject: opts.manifest.subject,
    level: opts.manifest.level,
    tags: opts.manifest.tags,
    access: opts.manifest.access || 'public',
    price: opts.manifest.price,
    currency: opts.manifest.currency,
    license: opts.manifest.license || 'Apache-2.0',
    ankr_interact_version: opts.interactVersion || '1.0.0',
    entry: opts.manifest.entry,
    contents: {
      docs:       opts.files.filter(f => f.path.startsWith('docs/')).map(f => f.path),
      assets:     opts.files.filter(f => f.path.startsWith('assets/')).map(f => f.path),
      quizzes:    opts.files.filter(f => f.path.startsWith('quizzes/')).map(f => f.path),
      flashcards: opts.files.filter(f => f.path.startsWith('flashcards/')).map(f => f.path),
      courses:    opts.files.filter(f => f.path.startsWith('courses/')).map(f => f.path),
      canvas:     opts.files.filter(f => f.path.startsWith('canvas/')).map(f => f.path),
    },
    integrity: {
      algorithm: 'sha256',
      files: fileHashes,
      manifest_hash: '',  // filled below
    },
  };

  // Hash the manifest (without manifest_hash) to get manifest_hash
  const manifestForHashing = { ...manifestWithoutHash, integrity: { ...manifestWithoutHash.integrity, manifest_hash: undefined } };
  const manifestHash = sha256(JSON.stringify(manifestForHashing));
  manifestWithoutHash.integrity.manifest_hash = manifestHash;

  // Add optional signature
  let finalManifest: BundleManifest = manifestWithoutHash as BundleManifest;
  if (opts.signKey) {
    const sigValue = hmac(manifestHash, opts.signKey);
    finalManifest = {
      ...manifestWithoutHash,
      signature: {
        algorithm: 'hmac-sha256',
        value: sigValue,
        signed_at: now,
      },
    } as BundleManifest;
  }

  zip.file('manifest.json', JSON.stringify(finalManifest, null, 2));

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}

// ── Unpack — read a .ib buffer ────────────────────────────────────────────────

export async function unpackBundle(buffer: Buffer): Promise<BundleContents> {
  const zip = await JSZip.loadAsync(buffer);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('BUNDLE_INVALID: missing manifest.json');

  const manifestRaw = await manifestFile.async('string');
  const manifest = BundleManifestSchema.parse(JSON.parse(manifestRaw));

  const files: BundleFile[] = [];
  for (const [path, zipFile] of Object.entries(zip.files)) {
    if (zipFile.dir || path === 'manifest.json') continue;
    const content = await zipFile.async('nodebuffer');
    files.push({ path, content });
  }

  return { manifest, files };
}

// ── Validate ──────────────────────────────────────────────────────────────────

export async function validateBundle(buffer: Buffer, signKey?: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { valid: false, errors: ['Not a valid ZIP file'], warnings: [] };
  }

  // Check manifest exists
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    return { valid: false, errors: ['Missing manifest.json'], warnings: [] };
  }

  let manifest: BundleManifest;
  try {
    const raw = await manifestFile.async('string');
    manifest = BundleManifestSchema.parse(JSON.parse(raw));
  } catch (e: unknown) {
    return { valid: false, errors: [`Invalid manifest: ${e instanceof Error ? e.message : String(e)}`], warnings: [] };
  }

  // Check file integrity
  for (const [filePath, expectedHash] of Object.entries(manifest.integrity.files)) {
    const zipEntry = zip.file(filePath);
    if (!zipEntry) {
      errors.push(`Missing file: ${filePath}`);
      continue;
    }
    const content = await zipEntry.async('nodebuffer');
    const actualHash = sha256(content);
    if (actualHash !== expectedHash) {
      errors.push(`Integrity failure: ${filePath} (expected ${expectedHash.slice(0, 8)}…, got ${actualHash.slice(0, 8)}…)`);
    }
  }

  // Check manifest hash
  const manifestForHashing = {
    ...manifest,
    integrity: { ...manifest.integrity, manifest_hash: undefined },
    signature: undefined,
  };
  const expectedManifestHash = sha256(JSON.stringify(manifestForHashing));
  if (expectedManifestHash !== manifest.integrity.manifest_hash) {
    errors.push('Manifest hash mismatch — bundle may have been tampered');
  }

  // Verify signature if key provided
  if (signKey && manifest.signature) {
    const expectedSig = hmac(manifest.integrity.manifest_hash, signKey);
    if (expectedSig !== manifest.signature.value) {
      errors.push('Signature verification failed');
    }
  } else if (manifest.signature && !signKey) {
    warnings.push('Bundle is signed but no verify key provided — signature not checked');
  }

  // Warn on large bundles
  if (buffer.length > 100 * 1024 * 1024) {
    warnings.push(`Large bundle: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  }

  // Check entry point exists
  if (manifest.entry) {
    const entryFile = zip.file(manifest.entry);
    if (!entryFile) {
      warnings.push(`Entry point not found in bundle: ${manifest.entry}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest: errors.length === 0 ? manifest : undefined,
  };
}

// ── Sign ──────────────────────────────────────────────────────────────────────

export async function signBundle(buffer: Buffer, signKey: string): Promise<Buffer> {
  const { manifest, files } = await unpackBundle(buffer);
  const sigValue = hmac(manifest.integrity.manifest_hash, signKey);
  const signedManifest: BundleManifest = {
    ...manifest,
    updated_at: new Date().toISOString(),
    signature: {
      algorithm: 'hmac-sha256',
      value: sigValue,
      signed_at: new Date().toISOString(),
    },
  };
  return packBundle({
    manifest: signedManifest,
    files,
    signKey,
    interactVersion: manifest.ankr_interact_version,
  });
}

// ── QR Code ───────────────────────────────────────────────────────────────────

export async function generateBundleQR(bundleUrl: string): Promise<string> {
  // Returns a data URI (PNG) — use dynamically to avoid bundling qrcode in all envs
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(bundleUrl, {
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ── Deep Link ─────────────────────────────────────────────────────────────────

export function buildDeepLink(bundleUrl: string): string {
  return `ankrinteract://import?url=${encodeURIComponent(bundleUrl)}`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function bundleSize(buffer: Buffer): { bytes: number; human: string } {
  const bytes = buffer.length;
  if (bytes < 1024) return { bytes, human: `${bytes} B` };
  if (bytes < 1024 * 1024) return { bytes, human: `${(bytes / 1024).toFixed(1)} KB` };
  return { bytes, human: `${(bytes / 1024 / 1024).toFixed(1)} MB` };
}

export function bundleSummary(manifest: BundleManifest): string {
  const c = manifest.contents;
  const parts = [];
  if (c.docs?.length)       parts.push(`${c.docs.length} doc${c.docs.length > 1 ? 's' : ''}`);
  if (c.quizzes?.length)    parts.push(`${c.quizzes.length} quiz${c.quizzes.length > 1 ? 'zes' : ''}`);
  if (c.flashcards?.length) parts.push(`${c.flashcards.length} deck${c.flashcards.length > 1 ? 's' : ''}`);
  if (c.courses?.length)    parts.push(`${c.courses.length} course${c.courses.length > 1 ? 's' : ''}`);
  if (c.canvas?.length)     parts.push(`${c.canvas.length} canvas`);
  return parts.join(' · ') || 'Empty bundle';
}
