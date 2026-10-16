import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { GuidanceSpeaker } from '../../web/vision-demo/speech.mjs';

function setup(getUserMedia) {
  const nodes = new Map(), docEvents = {};
  const context2d = {};
  const make = () => ({ disabled: false, textContent: '', style: {}, events: {},
    classList: { toggle() {} }, setAttribute() {},
    addEventListener(type, callback) { this.events[type] = callback; },
    getContext: () => context2d, play: async () => {}, videoWidth: 640, videoHeight: 480 });
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, make()); return nodes.get(selector); };
  const document = { querySelector: node, querySelectorAll: () => [], createElement: make,
    addEventListener: (type, callback) => { docEvents[type] = callback; } };
  let cancelledSpeech = 0;
  const synthesis = { cancel: () => cancelledSpeech++, getVoices: () => [], speak() {} };
  const environment = { GuidanceSpeaker, document, window: { addEventListener() {} },
    navigator: { mediaDevices: { getUserMedia } }, isSecureContext: true,
    speechSynthesis: synthesis, SpeechSynthesisUtterance: class {}, performance,
    cancelAnimationFrame() {}, requestAnimationFrame: () => 1 };
  // Use an injected speaker to exercise browser wiring without hardware or a DOM dependency.
  environment.GuidanceSpeaker = class extends GuidanceSpeaker {
    constructor(options) { super({ ...options, synthesis, Utterance: class {}, now: () => 0 }); }
  };
  const source = readFileSync(new URL('../../web/vision-demo/vision-demo.js', import.meta.url), 'utf8')
    .replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(source, environment);
  return { node, document, docEvents, cancelled: () => cancelledSpeech };
}

test('permission denial restores controls and offers retry', async () => {
  const h = setup(async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); });
  await h.node('#startCamera').events.click();
  assert.equal(h.node('#statusCode').textContent, 'CAMERA_UNAVAILABLE');
  assert.equal(h.node('#startCamera').disabled, false);
  assert.equal(h.node('#stopCamera').disabled, true);
  assert.match(h.node('#guidanceMessage').textContent, /permission was denied/);
});

test('stop during pending permission releases a late camera stream', async () => {
  let grant, stopped = 0;
  const h = setup(() => new Promise(resolve => { grant = resolve; }));
  const pending = h.node('#startCamera').events.click();
  assert.equal(h.node('#stopCamera').disabled, false);
  h.node('#stopCamera').events.click();
  grant({ getTracks: () => [{ stop: () => stopped++ }] });
  await pending;
  assert.equal(stopped, 1);
  assert.equal(h.node('#cameraVideo').srcObject, null);
  assert.equal(h.node('#startCamera').disabled, false);
});

test('hidden page cancels pending startup and speech', async () => {
  let grant, stopped = 0;
  const h = setup(() => new Promise(resolve => { grant = resolve; }));
  const pending = h.node('#startCamera').events.click();
  const before = h.cancelled();
  h.document.hidden = true;
  h.docEvents.visibilitychange();
  assert.ok(h.cancelled() > before);
  grant({ getTracks: () => [{ stop: () => stopped++ }] });
  await pending;
  assert.equal(stopped, 1);
});
