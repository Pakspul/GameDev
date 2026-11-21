// Small synthesised sounds (WebAudio, no files). Silent until the first tap (browsers require one).
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.lastPop = 0; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  }
  tone(freq, dur, { type = "sine", gain = 0.1, to = null, delay = 0 } = {}) {
    const c = this.ctx;
    if (!this.on || !c || c.state !== "running") return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  /** A take: a little pop that climbs while one mover keeps taking. */
  pop(streak) {
    const c = this.ctx;
    if (c && c.currentTime - this.lastPop < 0.025) return; // many at once: one sound
    if (c) this.lastPop = c.currentTime;
    const f = 520 * Math.pow(1.06, Math.min(streak, 18));
    this.tone(f, 0.07, { type: "triangle", gain: 0.07, to: f * 1.4 });
  }
  go() { this.tone(260, 0.14, { type: "triangle", gain: 0.07, to: 520 }); }
  park() { this.tone(330, 0.1, { type: "sine", gain: 0.09 }); this.tone(247, 0.12, { type: "sine", gain: 0.08, delay: 0.08 }); }
  done() { this.tone(784, 0.1, { type: "triangle", gain: 0.07 }); this.tone(1175, 0.14, { type: "triangle", gain: 0.06, delay: 0.07 }); }
  nope() { this.tone(160, 0.12, { type: "square", gain: 0.04 }); }
  undo() { this.tone(500, 0.1, { type: "sine", gain: 0.07, to: 300 }); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, { type: "triangle", gain: 0.09, delay: i * 0.09 })); }
  lose() { this.tone(392, 0.5, { type: "sawtooth", gain: 0.05, to: 110 }); }
}
