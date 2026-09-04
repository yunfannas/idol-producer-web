#!/usr/bin/env node
/**
 * Compatibility entry point for the former pilot generator.
 *
 * The previous implementation was a name-keyed table of final attributes. It
 * has been replaced by the evidence-driven V2 generator so regeneration no
 * longer encodes member-specific scores or Ability anchors.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const generator = path.resolve(here, '..', 'scripts', 'generateIdolAttributesFromEvidence.mjs');
const args = process.argv.slice(2);

if (!args.includes('--input')) args.push('--input', 'support/data/member-attribute-input-pilot3.json');
if (!args.includes('--out')) {
  args.push('--out', 'support/data/idol-attribute-generated/pilot3-evidence-driven-v2.json');
}

const result = spawnSync(process.execPath, [generator, ...args], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
