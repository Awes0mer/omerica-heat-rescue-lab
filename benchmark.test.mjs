import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildReport, serializeReport } from './benchmark-ai.mjs';

const frozenUrl = new URL('./dist/ai-benchmark.json', import.meta.url);

test('frozen ai-benchmark.json has the published SHA-256', async () => {
  assert.equal(createHash('sha256').update(await readFile(frozenUrl)).digest('hex'), '4bd86acf340a93016a78b4adb7d25d5e743bd9da8664cbe334c0e8f287079e34');
});

test('benchmark rebuilds dist/ai-benchmark.json byte for byte without writing it', async () => {
  const { report } = await buildReport();
  assert.equal(serializeReport(report), await readFile(frozenUrl, 'utf8'));
});
