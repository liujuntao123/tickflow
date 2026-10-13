#!/usr/bin/env node
// RRULE 定稿测试向量校验（消费 packages/contracts/test/rrule-vectors.json）
// 依赖已编译的 dist：先 `pnpm --filter @tickflow/server build`
//   node server/test/rrule-vectors.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { expandOccurrences, nextOccurrenceAfter, validateRecurrence } = require('../dist/common/recurrence.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const vectorsPath = path.resolve(here, '../../packages/contracts/test/rrule-vectors.json');
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf8'));

let passed = 0;
let failed = 0;

function check(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`ok   - ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL - ${name}${extra !== undefined ? ` :: ${JSON.stringify(extra)}` : ''}`);
  }
}

const iso = (d) => (d === null ? null : new Date(d).toISOString());

for (const c of vectors.occurrences) {
  validateRecurrence(c.rule);
  const got = expandOccurrences(c.rule, new Date(c.dtstart), new Date(c.from), new Date(c.to)).map(iso);
  check(`occurrences: ${c.name}`, JSON.stringify(got) === JSON.stringify(c.expect), { got, expect: c.expect });
}

for (const c of vectors.nextAfter) {
  validateRecurrence(c.rule);
  const got = iso(nextOccurrenceAfter(c.rule, new Date(c.dtstart), new Date(c.base)));
  check(`nextAfter: ${c.name}`, got === c.expect, { got, expect: c.expect });
}

for (const c of vectors.invalid) {
  let threw = false;
  let code;
  try {
    validateRecurrence(c.rule);
  } catch (e) {
    threw = true;
    code = e?.getResponse?.()?.code ?? e?.response?.code;
  }
  check(`invalid rejected: ${c.name}`, threw && code === 'invalid_recurrence', { threw, code });
}

console.log('\n========================================');
console.log(`RRULE vectors: 通过 ${passed} 项，失败 ${failed} 项`);
if (failed > 0) process.exit(1);
console.log('全部通过 ✅');