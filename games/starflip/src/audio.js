// Synthesised sounds (WebAudio, no files): pops for bumpers, clicks for flippers, rising chimes for
// mission steps, a whoosh into the wormhole. Silent until the first tap (browsers require one).
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
    if (c.currentTime - (this.last[name] || -1) < gap) return false; // a burst of the same sound in one frame is one sound
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
  chime(notes, step = 0.08, type = "triangle", gain = 0.09) { notes.forEach((f, i) => this.tone(f, 0.22, { type, gain, delay: i * step })); }

  play(f) {
    switch (f.type) {
      case "flip": if (this.ok("flip", 0.02)) this.noise(0.05, { gain: 0.12, freq: 600 }); break;
      case "bumper": if (this.ok("bumper")) { this.tone(180, 0.12, { type: "square", gain: 0.06, to: 90 }); this.tone(880, 0.06, { type: "triangle", gain: 0.05 }); } break;
      case "sling": if (this.ok("sling")) this.tone(320, 0.08, { type: "square", gain: 0.05, to: 160 }); break;
      case "drop": case "alien": if (this.ok("drop")) this.tone(520, 0.12, { type: "sawtooth", gain: 0.05, to: 260 }); break;
      case "standup": case "star": if (this.ok("standup")) this.tone(1200, 0.09, { type: "triangle", gain: 0.06 }); break;
      case "rock": if (this.ok("rock")) this.noise(0.08, { gain: 0.1, freq: 400 }); break;
      case "rockBreak": if (this.ok("rockBreak")) { this.noise(0.25, { gain: 0.14, freq: 250 }); this.tone(200, 0.2, { type: "square", gain: 0.05, to: 60 }); } break;
      case "spinner": if (this.ok("spinner", 0.05)) for (let i = 0; i < Math.min(8, f.spins); i++) this.tone(1500, 0.03, { type: "square", gain: 0.03, delay: i * 0.045 }); break;
      case "lane": if (this.ok("lane")) this.tone(1046, 0.1, { type: "triangle", gain: 0.07 }); break;
      case "orbit": this.tone(300, 0.35, { type: "sine", gain: 0.08, to: 900 }); break;
      case "hole": case "eject": if (this.ok("hole")) this.tone(140, 0.15, { type: "sine", gain: 0.12, to: 70 }); break;
      case "launch": this.noise(0.2, { gain: 0.08 + 0.1 * (f.power || 0.5), freq: 300 }); break;
      case "skill": this.chime([784, 988, 1175, 1568], 0.07); break;
      case "mult": this.chime([523, 659, 784], 0.06, "square", 0.05); break;
      case "progress": case "starLit": case "ufo": this.chime([880, 1320], 0.06); break;
      case "step": this.chime([659, 880, 1175], 0.07); break;
      case "dropBank": case "aliens": this.chime([440, 660, 880], 0.06, "square", 0.05); break;
      case "missionStart": this.chime([392, 523, 659, 784], 0.1, "square", 0.05); break;
      case "missionDone": this.chime([523, 659, 784, 1046, 1318, 1568], 0.08, "triangle", 0.1); break;
      case "missionFail": this.chime([392, 330, 262], 0.14, "sawtooth", 0.05); break;
      case "jackpot": case "ufoDown": case "core": case "supernova": this.chime([784, 1046, 1318, 1568, 2093], 0.06, "square", 0.06); break;
      case "superJackpot": case "mothership": this.chime([262, 330, 392, 523, 659, 784, 1046], 0.09, "square", 0.06); break;
      case "warp": this.tone(120, 1.1, { type: "sawtooth", gain: 0.06, to: 1800 }); this.noise(1.0, { gain: 0.05, freq: 900 }); break;
      case "miniEnd": this.tone(1600, 0.7, { type: "sine", gain: 0.06, to: 200 }); break;
      case "saved": this.chime([660, 990], 0.08); break;
      case "drain": this.tone(300, 0.7, { type: "sawtooth", gain: 0.06, to: 60 }); break;
      case "over": this.chime([523, 392, 330, 262], 0.18, "triangle", 0.08); break;
    }
  }
}
