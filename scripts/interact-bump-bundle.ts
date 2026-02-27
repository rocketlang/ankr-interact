#!/usr/bin/env tsx
/**
 * interact-bump-bundle.ts — ANKR Interact .ib bundle version bumper & differ
 *
 * Usage:
 *   # Bump version
 *   tsx scripts/interact-bump-bundle.ts bump <bundle.ib> [major|minor|patch] [--changelog="..."] [--key=<signKey>] [--out=<output.ib>]
 *
 *   # Diff two bundles
 *   tsx scripts/interact-bump-bundle.ts diff <old.ib> <new.ib>
 *
 * Exit codes:
 *   0 — success
 *   1 — error
 *
 * Apache 2.0 — ANKR Labs
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  bumpBundleVersion, diffBundles, compareSemver,
  type BumpType,
} from '../src/bundles/bundle-lib';

// ── ANSI colours ──────────────────────────────────────────────────────────────

const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;
const _ = (code: string) => (s: string) => NO_COLOR ? s : `\x1b[${code}m${s}\x1b[0m`;
const bold   = _('1');
const green  = _('32');
const red    = _('31');
const yellow = _('33');
const cyan   = _('36');
const gray   = _('90');
const white  = _('97');

// ── Arg helpers ───────────────────────────────────────────────────────────────

function flag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function loadIb(filePath: string): Buffer {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(red(`✖  File not found: ${resolved}`));
    process.exit(1);
  }
  return fs.readFileSync(resolved);
}

// ── bump command ──────────────────────────────────────────────────────────────

async function cmdBump(args: string[]) {
  const [inputPath, bumpArg, ...rest] = args;
  if (!inputPath) return showHelp();

  const bump = (bumpArg ?? 'patch') as BumpType;
  if (!['major', 'minor', 'patch'].includes(bump)) {
    console.error(red(`✖  Unknown bump type "${bump}". Use: major | minor | patch`));
    process.exit(1);
  }

  const changelog = flag(rest, 'changelog') ?? flag([bumpArg ?? '', ...rest], 'changelog');
  const signKey   = flag(rest, 'key')       ?? flag([bumpArg ?? '', ...rest], 'key');
  const outArg    = flag(rest, 'out')       ?? flag([bumpArg ?? '', ...rest], 'out');

  const inputBuffer = loadIb(inputPath);

  console.log(`\n${bold('ANKR Interact — Bundle Version Bumper')}`);
  console.log(gray('─'.repeat(48)));

  let newBuffer: Buffer;
  try {
    newBuffer = await bumpBundleVersion(inputBuffer, bump, changelog, signKey);
  } catch (e) {
    console.error(red(`\n✖  Failed: ${e instanceof Error ? e.message : String(e)}\n`));
    process.exit(1);
  }

  // Determine output path
  const base    = path.basename(inputPath, '.ib');
  const outPath = outArg ?? path.join(path.dirname(inputPath), `${base}-bumped.ib`);
  fs.writeFileSync(outPath, newBuffer);

  // Show diff summary between old and new
  const diff = await diffBundles(inputBuffer, newBuffer);

  console.log(`  ${cyan('Bump')}      ${bump}`);
  console.log(`  ${cyan('Version')}   ${diff.fromVersion} → ${green(diff.toVersion)}`);
  if (changelog) {
    console.log(`  ${cyan('Changelog')} ${changelog}`);
  }
  if (signKey) {
    console.log(`  ${cyan('Signed')}    yes`);
  }
  console.log(`  ${cyan('Output')}    ${outPath}`);
  console.log(gray('─'.repeat(48)));
  console.log(gray(`\n  No content changed (version-only bump)`));
  console.log(`\n  ${green(bold('✔  Done'))}\n`);
}

// ── diff command ──────────────────────────────────────────────────────────────

async function cmdDiff(args: string[]) {
  const [oldPath, newPath] = args;
  if (!oldPath || !newPath) return showHelp();

  const oldBuffer = loadIb(oldPath);
  const newBuffer = loadIb(newPath);

  console.log(`\n${bold('ANKR Interact — Bundle Diff')}`);
  console.log(gray('─'.repeat(56)));

  let diff: Awaited<ReturnType<typeof diffBundles>>;
  try {
    diff = await diffBundles(oldBuffer, newBuffer);
  } catch (e) {
    console.error(red(`\n✖  Diff failed: ${e instanceof Error ? e.message : String(e)}\n`));
    process.exit(1);
  }

  // Version comparison
  const cmp = compareSemver(diff.fromVersion, diff.toVersion);
  const versionNote = cmp < 0 ? green('↑ upgrade') : cmp > 0 ? red('↓ downgrade') : gray('= same');
  console.log(`  ${cyan('From')}       ${diff.fromVersion}  →  ${diff.toVersion}  ${versionNote}`);
  console.log(`  ${cyan('Bump level')} ${bold(diff.bumpLevel)}`);
  console.log('');

  // File changes
  const added    = diff.files.filter(f => f.change === 'added');
  const removed  = diff.files.filter(f => f.change === 'removed');
  const modified = diff.files.filter(f => f.change === 'modified');

  if (added.length > 0) {
    console.log(`  ${green(bold('Added'))} (${added.length})`);
    for (const f of added) console.log(`    ${green('+')} ${f.path}`);
    console.log('');
  }
  if (removed.length > 0) {
    console.log(`  ${red(bold('Removed'))} (${removed.length})`);
    for (const f of removed) console.log(`    ${red('-')} ${f.path}`);
    console.log('');
  }
  if (modified.length > 0) {
    console.log(`  ${yellow(bold('Modified'))} (${modified.length})`);
    for (const f of modified) {
      console.log(`    ${yellow('~')} ${f.path}`);
      console.log(`      ${gray(f.oldHash?.slice(0, 12) ?? '?')} → ${gray(f.newHash?.slice(0, 12) ?? '?')}`);
    }
    console.log('');
  }
  if (diff.unchanged > 0) {
    console.log(`  ${gray(`Unchanged: ${diff.unchanged} file${diff.unchanged !== 1 ? 's' : ''}`)}`);
    console.log('');
  }

  // Manifest changes
  if (diff.manifestChanges.length > 0) {
    console.log(`  ${cyan(bold('Manifest changes:'))}`);
    for (const ch of diff.manifestChanges) {
      const from = JSON.stringify(ch.from);
      const to   = JSON.stringify(ch.to);
      console.log(`    ${white(ch.field)}: ${gray(from)} → ${cyan(to)}`);
    }
    console.log('');
  }

  // Summary line
  console.log(gray('─'.repeat(56)));
  const parts = [
    added.length    ? green(`+${added.length}`)    : '',
    removed.length  ? red(`-${removed.length}`)    : '',
    modified.length ? yellow(`~${modified.length}`) : '',
  ].filter(Boolean);
  console.log(`\n  ${parts.length ? parts.join('  ') : gray('no changes')}\n`);
}

// ── Help ─────────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${bold('Usage:')}
  tsx scripts/interact-bump-bundle.ts bump <bundle.ib> [major|minor|patch] [options]
  tsx scripts/interact-bump-bundle.ts diff <old.ib> <new.ib>

${bold('bump options:')}
  --changelog="<message>"  Append changelog note to manifest description
  --key=<signKey>          Re-sign the bumped bundle with this key
  --out=<output.ib>        Output path (default: <name>-bumped.ib)

${bold('Examples:')}
  tsx scripts/interact-bump-bundle.ts bump my-course.ib patch
  tsx scripts/interact-bump-bundle.ts bump my-course.ib minor --changelog="Added Chapter 5"
  tsx scripts/interact-bump-bundle.ts diff v1.ib v2.ib
`);
  process.exit(0);
}

// ── Entry ─────────────────────────────────────────────────────────────────────

async function main() {
  const [,, command, ...rest] = process.argv;
  if (command === 'bump') {
    await cmdBump(rest);
  } else if (command === 'diff') {
    await cmdDiff(rest);
  } else {
    showHelp();
  }
}

main().catch(e => {
  console.error(red(`\n✖  ${e instanceof Error ? e.message : String(e)}\n`));
  process.exit(1);
});
