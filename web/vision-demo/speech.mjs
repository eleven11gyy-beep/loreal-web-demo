// Browser counterpart of voice/VoiceSpeaker. Feed only fresh vision guidance.
export class GuidanceSpeaker {
  constructor({ synthesis = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance,
    now = () => performance.now(), onStatus = () => {} } = {}) {
    this.synthesis = synthesis;
    this.Utterance = Utterance;
    this.now = now;
    this.onStatus = onStatus;
    this.available = Boolean(synthesis && Utterance);
    this.enabled = this.available;
    this.clear();
    this.status(this.available ? "点击“测试语音”检查中文播报。" : "此浏览器不支持语音播报，请查看文字提示。");
  }

  status(message) { this.onStatus(message, this.enabled, this.available); }

  clear() {
    // Ignore callbacks from an utterance cancelled by a newer command.
    this.generation = (this.generation || 0) + 1;
    this.synthesis?.cancel();
    this.key = null;
    this.pendingKey = null;
    this.pendingAt = 0;
    this.lastSpokenAt = -Infinity;
    this.lastSignalAt = -Infinity;
  }

  setEnabled(enabled) {
    this.clear();
    this.enabled = this.available && enabled;
    this.status(this.enabled ? "语音已开启。" : "语音已关闭，方向仍会显示在页面上。");
  }

  say(text) {
    if (!this.enabled) return;
    const generation = ++this.generation;
    this.synthesis.cancel();
    const utterance = new this.Utterance(text);
    const voices = this.synthesis.getVoices();
    utterance.voice = voices.find(v => /^zh[-_]CN$/i.test(v.lang)) || voices.find(v => /^zh/i.test(v.lang)) || null;
    utterance.lang = "zh-CN";
    utterance.rate = 1.05;
    utterance.onstart = () => { if (generation === this.generation) this.status(`正在播报：${text}`); };
    utterance.onerror = () => {
      if (generation !== this.generation) return;
      this.setEnabled(false);
      this.status("语音播放失败，请点击“开启语音”后测试，并检查设备中文音色及音量。");
    };
    this.synthesis.speak(utterance);
  }

  test() {
    if (!this.available) return;
    this.setEnabled(true);
    this.say("语音已准备好，请将人脸和口红放入画面。");
  }

  update(command) {
    if (!this.enabled) return;
    if (!command) { this.clear(); return; }
    const now = this.now();
    // A long gap in frames must never count as continuous tracking.
    if (now - this.lastSignalAt > 1000) this.clear();
    this.lastSignalAt = now;
    const key = `${command.action}:${command.direction}:${command.target_region}`;
    if (key !== this.pendingKey) {
      this.generation++;
      this.synthesis.cancel();
      this.pendingKey = key;
      this.pendingAt = now;
    }
    const urgent = command.direction === "HOLD" || command.action === "NEXT_REGION" || command.action === "STOP";
    if (!urgent && now - this.pendingAt < 250) return;
    if (key === this.key && now - this.lastSpokenAt < 5000) return;
    this.key = key;
    this.lastSpokenAt = now;
    this.say(command.text);
  }
}
