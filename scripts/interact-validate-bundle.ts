#!/usr/bin/env tsx
/**
 * interact-validate-bundle.ts — ANKR Interact .ib bundle validator CLI
 *
 * Usage:
 *   npm run interact:validate path/to/bundle.ib
 *   npm run interact:validate path/to/bundle.ib --key=<signKey>
 *   tsx scripts/interact-validate-bundle.ts bundle.ib
 *
 * Exit codes:
 *   0 — valid
 *   1 — invalid or error
 *
 * Apache 2.0 — ANKR Labs
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateBundle, bundleSize, bundleSummary } from '../src/bundles/bundle-lib';

// ── ANSI colours (work in most terminals; degrade gracefully) ─────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
};

const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;
const col = NO_COLOR
  ? Object.fromEntries(Object.keys(c).map(k => [k, ''])) as typeof c
  : c;

function bold(s: string)   { return `${col.bold}${s}${col.reset}`; }
function green(s: string)  { return `${col.green}${s}${col.reset}`; }
function red(s: string)    { return `${col.red}${s}${col.reset}`; }
function yellow(s: string) { return `${col.yellow}${s}${col.reset}`; }
function cyan(s: string)   { return `${col.cyan}${s}${col.reset}`; }
function gray(s: string)   { return `${col.gray}${s}${col.reset}`; }

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { filePath: string | null; signKey: string | undefined } {
  const args = argv.slice(2); // drop "node" and script path
  let filePath: string | null = null;
  let signKey: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--key=')) {
      signKey = arg.slice(6);
    } else if (!arg.startsWith('--')) {
      filePath = arg;
    }
  }

  return { filePath, signKey };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { filePath, signKey } = parseArgs(process.argv);

  if (!filePath) {
    console.error(bold('\nUsage:'));
    console.error('  npm run interact:validate <bundle.ib> [--key=<signKey>]\n');
    console.error('Examples:');
    console.error('  npm run interact:validate my-course.ib');
    console.error('  npm run interact:validate my-course.ib --key=my-secret\n');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);

  // Existence check
  if (!fs.existsSync(resolvedPath)) {
    console.error(red(`\n✖  File not found: ${resolvedPath}\n`));
    process.exit(1);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== '.ib') {
    console.warn(yellow(`⚠  Warning: expected .ib extension, got "${ext}"\n`));
  }

  // Read file
  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(resolvedPath);
  } catch (e) {
    console.error(red(`\n✖  Cannot read file: ${e instanceof Error ? e.message : String(e)}\n`));
    process.exit(1);
  }

  const size = bundleSize(buffer);
  console.log(`\n${bold('ANKR Interact — .ib Bundle Validator')}`);
  console.log(gray('─'.repeat(50)));
  console.log(`  ${cyan('File')}    ${path.basename(resolvedPath)}`);
  console.log(`  ${cyan('Path')}    ${gray(resolvedPath)}`);
  console.log(`  ${cyan('Size')}    ${size.human} (${size.bytes.toLocaleString()} bytes)`);
  if (signKey) {
    console.log(`  ${cyan('Sign key')} provided`);
  }
  console.log(gray('─'.repeat(50)));

  // Validate
  let result: Awaited<ReturnType<typeof validateBundle>>;
  try {
    result = await validateBundle(buffer, signKey);
  } catch (e) {
    console.error(red(`\n✖  Validation threw an unexpected error:`));
    console.error(red(`   ${e instanceof Error ? e.message : String(e)}\n`));
    process.exit(1);
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log(`\n  ${bold(red('Errors:'))}`);
    for (const err of result.errors) {
      console.log(`    ${red('✖')} ${err}`);
    }
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log(`\n  ${bold(yellow('Warnings:'))}`);
    for (const warn of result.warnings) {
      console.log(`    ${yellow('⚠')} ${warn}`);
    }
  }

  // Print manifest summary if valid
  if (result.valid && result.manifest) {
    const m = result.manifest;
    console.log(`\n  ${bold('Manifest:')}`);
    console.log(`    ${cyan('ID')}       ${gray(m.id)}`);
    console.log(`    ${cyan('Name')}     ${m.name}`);
    console.log(`    ${cyan('Slug')}     ${m.slug}`);
    console.log(`    ${cyan('Version')}  ${m.version}`);
    console.log(`    ${cyan('Author')}   ${m.author.name}${m.author.email ? ` <${m.author.email}>` : ''}`);
    console.log(`    ${cyan('License')}  ${m.license}`);
    console.log(`    ${cyan('Access')}   ${m.access}${m.price !== undefined ? ` (${m.currency ?? 'INR'} ${m.price})` : ''}`);
    const summary = bundleSummary(m);
    if (summary) {
      console.log(`    ${cyan('Contents')} ${summary}`);
    }
    if (m.signature) {
      const sigStatus = signKey
        ? (result.errors.some(e => e.includes('Signature')) ? red('INVALID') : green('VERIFIED'))
        : yellow('UNVERIFIED (no key)');
      console.log(`    ${cyan('Signature')} ${sigStatus} — signed ${gray(m.signature.signed_at)}`);
    }
  }

  // Final verdict
  console.log(gray('\n' + '─'.repeat(50)));
  if (result.valid) {
    console.log(`\n  ${green(bold('✔  VALID'))}  — bundle passed all checks\n`);
    process.exit(0);
  } else {
    console.log(`\n  ${red(bold('✖  INVALID'))}  — ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} found\n`);
    process.exit(1);
  }
}

main();
