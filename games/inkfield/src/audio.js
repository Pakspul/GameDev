// Small synthesised sounds (WebAudio, no files): a rising blip for a claim, a snap for a cut,
// a falling tone when you're out. Silent until the first tap (browsers require one).
export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  }
  tone(freq, dur, { type = "sine", gain = 0.12, to = null, delay = 0 } = {}) {
    const c = this.ctx;
    if (!this.on || !c || c.state !== "running") return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  claim(size) {
    const n = Math.min(4, 1 + Math.floor(Math.log2(1 + size / 40)));
    for (let i = 0; i < n; i++) this.tone(520 * Math.pow(1.26, i), 0.12, { type: "triangle", gain: 0.1, delay: i * 0.06 });
  }
  cut() { this.tone(900, 0.18, { type: "square", gain: 0.06, to: 220 }); this.tone(1400, 0.08, { type: "triangle", gain: 0.08 }); }
  out() { this.tone(420, 0.6, { type: "sawtooth", gain: 0.07, to: 90 }); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: "triangle", gain: 0.1, delay: i * 0.1 })); }
}
