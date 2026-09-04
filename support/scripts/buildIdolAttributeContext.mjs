#!/usr/bin/env node
import { spawn } from 'node:child_process';

const scripts = [
  'support/scripts/buildGroupTierHistory.mjs',
  'support/scripts/buildIdolCareerContext.mjs',
];

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit' });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
    child.on('error', reject);
  });
}

for (const script of scripts) await run(script);
console.log('Historical idol attribute context is ready.');
