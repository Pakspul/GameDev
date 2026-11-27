// Synthesised sounds (WebAudio, no files): a soft whoosh to fire, a click on the walls, a thunk when a
// bubble sticks, pops that climb with the size of the group, a slide for falling bubbles, a chime for
// powers. Silent until the first tap (browsers require one).
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.last = {}; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  }
  ok(name, gap = 0.03) {
    const c = this.ctx;
    if (!this.on || !c || c.state !== "running") return false;
    if (c.currentTime - (this.last[name] || -1) < gap) return false;
    this.last[name] = c.currentTime;
    return true;
  }
  tone(freq, dur, { type = "sine", gain = 0.1, to = null, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
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
  noise(dur, { gain = 0.08, freq = 1200, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  chime(notes, step = 0.08, type = "triangle", gain = 0.08) { notes.forEach((f, i) => this.tone(f, 0.22, { type, gain, delay: i * step })); }

  play(e) {
    if (!this.ok(e.type, 0.02)) return;
    switch (e.type) {
      case "fire":
        if (e.shot.p === "comet") { this.noise(0.5, { gain: 0.12, freq: 700 }); this.tone(200, 0.5, { type: "sawtooth", gain: 0.04, to: 900 }); }
        else { this.noise(0.12, { gain: 0.07, freq: 1800 }); this.tone(420, 0.1, { gain: 0.05, to: 700 }); }
        break;
      case "bounce": this.tone(1400, 0.04, { type: "triangle", gain: 0.04 }); break;
      case "land": if (!e.shot.p || e.shot.p === "prism") this.tone(170, 0.08, { type: "triangle", gain: 0.09, to: 110 }); break;
      case "pop": {
        const n = e.list.length, base = 520 * Math.pow(1.06, Math.min(12, e.combo || 0));
        for (let i = 0; i < Math.min(6, n); i++) this.tone(base * (1 + i * 0.12), 0.09, { type: "sine", gain: 0.08, delay: i * 0.035, to: base * 1.6 });
        if (e.power === "bomb") { this.noise(0.5, { gain: 0.2, freq: 160 }); this.tone(90, 0.45, { type: "square", gain: 0.06, to: 40 }); }
        if (e.power === "laser") this.tone(2200, 0.35, { type: "sawtooth", gain: 0.05, to: 300 });
        if (e.power === "blackhole") this.tone(600, 0.8, { type: "sine", gain: 0.1, to: 50 });
        break;
      }
      case "drop": this.tone(700, 0.35, { type: "triangle", gain: 0.06, to: 180 }); break;
      case "power": this.chime([784, 1046, 1318], 0.06); break;
      case "free": this.chime([660, 880, 1320, 1760], 0.05, "sine", 0.07); break;
      case "arm": this.tone(e.p ? 900 : 500, 0.08, { type: "triangle", gain: 0.06 }); break;
      case "swap": this.tone(600, 0.06, { type: "triangle", gain: 0.05, to: 800 }); break;
      case "freeze": this.chime([1568, 1318, 1046, 1568], 0.05, "sine", 0.06); break;
      case "ceiling": this.noise(0.3, { gain: 0.15, freq: 220 }); this.tone(110, 0.3, { type: "square", gain: 0.05, to: 70 }); break;
      case "push": this.tone(140, 0.25, { type: "sawtooth", gain: 0.04, to: 90 }); break;
      case "stage": case "won": this.chime([523, 659, 784, 1046, 1318], 0.08, "triangle", 0.09); break;
      case "lost": this.chime([440, 349, 294, 220], 0.15, "sawtooth", 0.05); break;
      case "nope": this.tone(200, 0.1, { type: "square", gain: 0.04 }); break;
    }
  }
}
