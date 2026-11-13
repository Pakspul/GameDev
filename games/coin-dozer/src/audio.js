// Sound, synthesised with WebAudio: no audio files, nothing to download. Each machine theme has its
// own palette (wave shape, root note, scale) for chimes and fanfares; clinks stay metallic.
//
// At most `feedback.voices` sounds play at once. When a new one would exceed that, the quietest
// playing voice is cut, so a hundred coins landing in one frame never overloads the audio engine.
import { CONFIG } from "./config.js";

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.palette = { wave: "triangle", root: 523.25, scale: [0, 4, 7, 12, 16, 19, 24, 28] };
    this.voices = [];          // { gain (peak), end, nodes: [...] }
    this.lastTick = 0;
  }
  setPalette(p) { if (p) this.palette = p; }
  setOn(on) { this.on = !!on; if (!on) this.stopAll(); }

  /** Browsers only allow audio after a touch; call this from the first one. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let s = 2463534242;
      for (let i = 0; i < len; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296 * 2 - 1) * (1 - i / len); }
    } catch (e) { this.ctx = null; }
  }
  suspend() { if (this.ctx && this.ctx.state === "running") this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }
  stopAll() { for (const v of this.voices) for (const n of v.nodes) try { n.stop(); } catch (e) { /* already stopped */ } this.voices = []; }

  ready() { return this.on && this.ctx && this.ctx.state === "running"; }

  /** Make room for a voice of this loudness; false if every playing voice is louder (then skip it). */
  claim(gain) {
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length < CONFIG.feedback.voices) return true;
    let q = 0;
    for (let i = 1; i < this.voices.length; i++) if (this.voices[i].gain < this.voices[q].gain) q = i;
    if (this.voices[q].gain > gain) return false;
    for (const n of this.voices[q].nodes) try { n.stop(); } catch (e) { /* fine */ }
    this.voices.splice(q, 1);
    return true;
  }

  /** One voice: an oscillator (and optionally a noise click) with a fast attack and an exponential decay. */
  voice({ freq, dur = 0.15, wave = "sine", gain = 0.2, delay = 0, slideTo, click = 0, partial }) {
    if (!this.ready() || !this.claim(gain)) return;
    const c = this.ctx, t = c.currentTime + delay, nodes = [];
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    const o = c.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02); nodes.push(o);
    if (partial) {
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = "sine"; o2.frequency.setValueAtTime(freq * partial, t);
      g2.gain.value = 0.35;
      o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + dur + 0.02); nodes.push(o2);
    }
    if (click && this.noise) {
      const n = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
      n.buffer = this.noise; f.type = "highpass"; f.frequency.value = 3500;
      gn.gain.setValueAtTime(click * gain, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(f); f.connect(gn); gn.connect(this.master); n.start(t); n.stop(t + 0.05); nodes.push(n);
    }
    this.voices.push({ gain, end: t + dur + 0.03, nodes });
  }

  note(step, octave = 0) {
    const sc = this.palette.scale;
    const i = ((step % sc.length) + sc.length) % sc.length, up = Math.floor(step / sc.length) + octave;
    return this.palette.root * Math.pow(2, (sc[i] + up * 12) / 12);
  }

  // ---- The game's sounds ------------------------------------------------------------------------------------
  release() { this.voice({ freq: 1800, dur: 0.05, wave: "square", gain: 0.03, click: 0.6 }); }
  /** A coin lands on the pile; `pitch` is a seeded value in [0, 1) for a little variety. */
  land(pitch, loud = 1) { this.voice({ freq: 2300 + pitch * 700, dur: 0.09, wave: "sine", gain: 0.05 * loud, partial: 2.76, click: 0.8 }); }
  pin(pitch, loud = 1) { this.voice({ freq: 3200 + pitch * 900, dur: 0.05, wave: "sine", gain: 0.03 * loud, partial: 2.4, click: 0.5 }); }
  thud() { this.voice({ freq: 180, dur: 0.12, wave: "sine", gain: 0.12, slideTo: 90, click: 0.3 }); }
  tray(gold) { gold ? this.voice({ freq: 1250, dur: 0.22, wave: "sine", gain: 0.12, partial: 2.4, click: 0.5 }) : this.voice({ freq: 1900, dur: 0.14, wave: "sine", gain: 0.08, partial: 2.76, click: 0.6 }); }
  /** Rising clinks in a cascade: step n climbs, capped. */
  cascade(n) {
    const s = Math.min(n, CONFIG.feedback.cascadeSteps);
    this.voice({ freq: this.note(s, 1), dur: 0.16, wave: this.palette.wave, gain: 0.07 + s * 0.008, partial: 3, click: 0.3 });
  }
  chime() {
    [0, 2, 4].forEach((s, i) => this.voice({ freq: this.note(s + 3, 1), dur: 0.5, wave: this.palette.wave, gain: 0.12, delay: i * 0.08, partial: 2 }));
  }
  fanfare(kind) {
    const seq = kind === "jackpot" ? [0, 2, 4, 7, 9, 11] : kind === "fever" ? [0, 4, 2, 5, 4, 7] : kind === "wide" ? [0, 3, 5] : [0, 2, 4, 6];
    seq.forEach((s, i) => this.voice({ freq: this.note(s, 0), dur: 0.22, wave: this.palette.wave, gain: 0.13, delay: i * 0.09, partial: 2 }));
  }
  nudge() { this.voice({ freq: 120, dur: 0.25, wave: "triangle", gain: 0.18, slideTo: 70, click: 0.5 }); }
  denied() { this.voice({ freq: 220, dur: 0.12, wave: "square", gain: 0.05, slideTo: 160 }); }
  /** Bank counter tick, throttled to `feedback.tickPerSecond`. */
  tick() {
    if (!this.ready()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTick < 1 / CONFIG.feedback.tickPerSecond) return;
    this.lastTick = now;
    this.voice({ freq: 3200, dur: 0.025, wave: "square", gain: 0.012 });
  }
  buy() { [0, 4].forEach((s, i) => this.voice({ freq: this.note(s, 1), dur: 0.18, wave: "sine", gain: 0.1, delay: i * 0.07 })); }
}
