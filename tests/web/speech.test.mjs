import test from 'node:test';
import assert from 'node:assert/strict';
import { GuidanceSpeaker } from '../../web/vision-demo/speech.mjs';

function setup() {
  let time = 0;
  const spoken = [], statuses = [];
  const synthesis = { cancelCount: 0, cancel() { this.cancelCount++; },
    getVoices: () => [{ lang: 'en-US' }, { lang: 'zh-CN' }], speak: u => spoken.push(u) };
  const speaker = new GuidanceSpeaker({ synthesis, Utterance: class { constructor(text) { this.text = text; } },
    now: () => time, onStatus: (...args) => statuses.push(args) });
  return { speaker, synthesis, spoken, statuses, at(t, direction = 'LEFT', action = 'MOVE') {
    time = t;
    speaker.update({ action, direction, target_region: 'lip_peak', text: direction });
  } };
}

test('direction changes cancel immediately, stabilize, and bypass repeat cooldown', () => {
  const h = setup();
  h.at(0); h.at(300);
  assert.deepEqual(h.spoken.map(u => u.text), ['LEFT']);
  const cancelled = h.synthesis.cancelCount;
  h.at(400, 'RIGHT');
  assert.ok(h.synthesis.cancelCount > cancelled);
  assert.equal(h.spoken.length, 1);
  h.at(700, 'RIGHT');
  assert.deepEqual(h.spoken.map(u => u.text), ['LEFT', 'RIGHT']);
  assert.equal(h.spoken[1].voice.lang, 'zh-CN');
});

test('same direction repeats after five seconds only with fresh signals', () => {
  const h = setup();
  h.at(0); h.at(300);
  for (let t = 600; t < 5300; t += 300) h.at(t);
  assert.equal(h.spoken.length, 1);
  h.at(5300);
  assert.equal(h.spoken.length, 2);
  // A gap resets stabilization instead of treating a stale command as continuous.
  h.at(8000, 'RIGHT');
  assert.equal(h.spoken.length, 2);
  h.at(8300, 'RIGHT');
  assert.equal(h.spoken.length, 3);
});

test('lost tracking clears previous speech and restarts stabilization', () => {
  const h = setup();
  h.at(0); h.at(300);
  const old = h.spoken[0];
  h.speaker.update(null);
  old.onerror(); // cancellation callbacks cannot disable new speech
  assert.equal(h.speaker.enabled, true);
  h.at(400); assert.equal(h.spoken.length, 1);
  h.at(700); assert.equal(h.spoken.length, 2);
});

test('hold and next region interrupt movement without waiting for debounce', () => {
  const h = setup();
  h.at(0); h.at(300);
  h.at(400, 'HOLD');
  h.at(500, 'HOLD', 'NEXT_REGION');
  assert.deepEqual(h.spoken.map(u => u.text), ['LEFT', 'HOLD', 'HOLD']);
});

test('mute, test speech, and playback errors leave a recoverable state', () => {
  const h = setup();
  h.speaker.setEnabled(false);
  h.at(0); h.at(300);
  assert.equal(h.spoken.length, 0);
  h.speaker.test();
  assert.equal(h.speaker.enabled, true);
  assert.equal(h.spoken.length, 1);
  h.spoken[0].onerror();
  assert.equal(h.speaker.enabled, false);
  assert.match(h.statuses.at(-1)[0], /播放失败/);
  h.speaker.test();
  assert.equal(h.speaker.enabled, true);
});

test('unsupported browsers retain text-only functionality', () => {
  const speaker = new GuidanceSpeaker({ synthesis: null, Utterance: null });
  assert.equal(speaker.available, false);
  assert.doesNotThrow(() => { speaker.test(); speaker.update(null); speaker.clear(); });
});
