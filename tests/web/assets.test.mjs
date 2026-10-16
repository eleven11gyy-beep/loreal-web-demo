import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const root = resolve(import.meta.dirname, '../../web');
function checkReference(source, reference) {
  if (/^(#|https?:|data:)/.test(reference)) return;
  assert.ok(!reference.startsWith('/'), `${source}: root-relative URL breaks project Pages: ${reference}`);
  const target = resolve(dirname(source), reference.split(/[?#]/)[0]);
  assert.ok(!relative(root, target).startsWith('..'), `${reference} escapes published web directory`);
  assert.ok(statSync(target).isFile(), `missing asset ${target}`);
}

test('HTML and application assets resolve under a repository subpath', () => {
  for (const file of ['index.html', 'vision-demo/index.html']) {
    const path = resolve(root, file), html = readFileSync(path, 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) checkReference(path, match[1]);
  }
  for (const file of ['app.js', 'vision-demo/vision-demo.js', 'vision-demo/vision-demo.css', 'styles.css']) {
    const path = resolve(root, file), source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\(|modelAssetPath:)["']([^"']+)["']/g)) checkReference(path, match[1]);
    for (const match of source.matchAll(/url\(["']?([^\s)"']+)/g)) checkReference(path, match[1]);
  }
  const vendor = resolve(root, 'vision-demo/vendor');
  assert.ok(statSync(resolve(vendor, 'face_landmarker.task')).size > 1_000_000);
  const wasm = readdirSync(resolve(vendor, 'package/wasm')).filter(f => f.endsWith('.wasm'));
  assert.ok(wasm.length > 0);
  for (const name of wasm) assert.ok(statSync(resolve(vendor, 'package/wasm', name)).size > 1_000_000);
});
