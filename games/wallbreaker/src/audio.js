// Sound, synthesised with WebAudio: no audio files, nothing to download. Each sound pack is a set of
// voices (wave shape, pitch, envelope). The hit sound climbs in pitch with the combo.
// Music is a quiet generated loop that only runs while a level is being played.

const PACKS = {
  "sound.arcade": { wave: "square", base: 330, decay: 0.09, gain: 0.16, noise: 0.5 },
  "sound.marimba": { wave: "sine", base: 392, decay: 0.22, gain: 0.32, noise: 0.3, overtone: 4 },
  "sound.chip": { wave: "square", base: 262, decay: 0.07, gain: 0.13, noise: 0.6, slide: true },
  "sound.glass": { wave: "triangle", base: 784, decay: 0.3, gain: 0.22, noise: 0.25, overtone: 2.76 },
  "sound.drums": { wave: "sine", base: 110, decay: 0.16, gain: 0.45, noise: 1, thump: true },
};
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36]; // major pentatonic steps

export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.musicVolume = 0.35;
    this.pack = PACKS["sound.arcade"];
    this.musicOn = false;
    this.step = 0;
    this.timer = null;
  }
  setPack(id) { this.pack = PACKS[id] || PACKS["sound.arcade"]; }
  setVolumes(sound, music) {
    this.volume = sound;
    this.musicVolume = music;
    if (this.musicGain) this.musicGain.gain.value = music * 0.22;
    if (this.master) this.master.gain.value = sound;
  }
  /** Browsers only allow audio after a tap; call this from the first one. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.22;
      this.musicGain.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.4;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff - 1) * (1 - i / len); }
    } catch (e) { this.ctx = null; }
  }
  suspend() { if (this.ctx && this.ctx.state === "running") this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  tone(freq, dur, { wave, gain = 1, slideTo, delay = 0, dest } = {}) {
    if (!this.ctx || this.volume <= 0) return;
    const P = this.pack, c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave || P.wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(P.gain * gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
    if (P.overtone && !wave) this.tone(freq * P.overtone, dur * 0.5, { wave: "sine", gain: gain * 0.25, delay, dest });
  }
  noise(dur, gain = 1, hp = 800) {
    if (!this.ctx || this.volume <= 0) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = "highpass"; f.frequency.value = hp;
    g.gain.setValueAtTime(this.pack.gain * this.pack.noise * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur);
  }
  note(step) { return this.pack.base * Math.pow(2, SCALE[Math.min(SCALE.length - 1, step)] / 12); }

  play(name, v = {}) {
    if (!this.ctx || this.volume <= 0) return;
    const P = this.pack;
    switch (name) {
      case "paddle": this.tone(P.base * 0.75, P.decay * 1.2, { gain: 0.9, slideTo: P.slide ? P.base : undefined }); if (P.thump) this.noise(0.05, 0.4, 200); break;
      case "wall": this.tone(P.base * 0.5, P.decay * 0.6, { gain: 0.35 }); break;
      case "hit": this.tone(this.note(Math.min(15, (v.combo || 0))), P.decay, { gain: 0.7 }); break;
      case "break": this.tone(this.note(Math.min(15, (v.combo || 1) - 1) + 0) * 1.0, P.decay * 1.4, { gain: 0.8 }); this.noise(0.05, 0.25, 2500); break;
      case "steel": this.tone(P.base * 2.2, 0.08, { wave: "triangle", gain: 0.5 }); break;
      case "explode": this.noise(0.35, 1.4, 120); this.tone(70, 0.3, { wave: "sine", gain: 1.2, slideTo: 40 }); break;
      case "catch": this.tone(P.base * 1.5, 0.12, { gain: 0.7 }); this.tone(P.base * 2, 0.16, { gain: 0.6, delay: 0.07 }); break;
      case "risky": this.tone(P.base * 0.8, 0.18, { wave: "sawtooth", gain: 0.6 }); this.tone(P.base * 1.6, 0.25, { wave: "sawtooth", gain: 0.5, delay: 0.1 }); break;
      case "lose": this.tone(P.base, 0.5, { wave: "triangle", gain: 0.9, slideTo: P.base / 3 }); break;
      case "clear": [0, 2, 4, 5].forEach((s, i) => this.tone(this.note(s + 5), 0.25, { gain: 0.8, delay: i * 0.09 })); break;
      case "fail": [5, 3, 1].forEach((s, i) => this.tone(this.note(s), 0.3, { gain: 0.7, delay: i * 0.13 })); break;
      case "laser": this.tone(P.base * 3, 0.07, { wave: "sawtooth", gain: 0.35, slideTo: P.base * 1.5 }); break;
      case "portal": this.tone(P.base * 1.2, 0.2, { wave: "sine", gain: 0.6, slideTo: P.base * 2.4 }); break;
      case "zap": this.noise(0.08, 0.6, 3000); break;
      case "launch": this.tone(P.base, 0.08, { gain: 0.6, slideTo: P.base * 1.5 }); break;
      case "plus": this.tone(this.note(10), 0.12, { gain: 0.6 }); break;
      case "net": this.tone(P.base * 0.6, 0.15, { wave: "triangle", gain: 0.8 }); break;
      case "click": this.tone(P.base * 2, 0.03, { gain: 0.25 }); break;
      case "buy": this.tone(this.note(7), 0.1, { gain: 0.6 }); this.tone(this.note(9), 0.16, { gain: 0.6, delay: 0.08 }); break;
    }
  }

  // ---- Music: a calm bass and arpeggio in the pack's key ---------------------------------------
  startMusic() {
    if (this.musicOn || !this.ctx || this.musicVolume <= 0) return;
    this.musicOn = true;
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
  }
  stopMusic() {
    this.musicOn = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const beat = 60 / 96 / 2;
    while (this.next < this.ctx.currentTime + 0.3) {
      const i = this.step++ % 64;
      const bar = Math.floor(i / 16) % 4;
      const root = [0, 5, 3, 4][bar];
      const t = this.next - this.ctx.currentTime;
      if (i % 4 === 0) this.voice(this.pack.base / 4 * Math.pow(2, [0, 9, 5, 7][bar] / 12), beat * 3.5, t, "triangle", 0.9);
      if (i % 2 === 0) {
        const arp = [0, 2, 4, 2][(i / 2) % 4];
        this.voice(this.note(root + arp + 2) / 2, beat * 1.6, t, "sine", 0.35);
      }
      this.next += beat;
    }
  }
  voice(freq, dur, delay, wave, gain) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
