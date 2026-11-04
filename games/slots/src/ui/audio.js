// Audio (FEEL-02/03/05): every sound effect and every music loop is synthesised with Web Audio,
// so the game ships no audio files and works offline.
//
// Music: each state has its own short loop, scheduled note by note on the audio clock. There is no
// audio file that could leave a gap at the loop point; the loop is simply the pattern starting over.
// Changing state crossfades from one loop to the next.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MUSIC = {
  // bpm, chord roots per bar (semitones above the track root), chord quality, arpeggio pattern (chord-tone index or null per 16th)
  lobby: { bpm: 84, root: 57, prog: [0, 8, 3, 10], minor: true, arp: [0, null, 1, null, 2, null, 1, null, 0, null, 1, null, 2, null, 3, null], wave: "triangle", pad: true, hat: false, bass: 0.5 },
  base: { bpm: 104, root: 57, prog: [0, 5, 8, 7], minor: true, arp: [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 0, 3, 2, 1], wave: "sine", pad: true, hat: true, bass: 0.7 },
  free: { bpm: 126, root: 60, prog: [0, 7, 9, 5], minor: false, arp: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 3], wave: "triangle", pad: true, hat: true, bass: 0.8 },
  hold: { bpm: 118, root: 52, prog: [0, 0, 3, 1], minor: true, arp: [0, null, 0, null, 2, null, 0, 1, 0, null, 0, null, 2, null, 3, null], wave: "sawtooth", pad: false, hat: true, bass: 1, low: true },
  pick: { bpm: 112, root: 62, prog: [0, 5, 7, 5], minor: false, arp: [0, null, 2, 1, null, 3, 2, null, 0, null, 2, 1, null, 3, 1, null], wave: "square", pad: false, hat: true, bass: 0.6 },
  win: { bpm: 138, root: 64, prog: [0, 5, 7, 0], minor: false, arp: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 0], wave: "triangle", pad: true, hat: true, bass: 0.8 },
};

export class AudioEngine {
  constructor(getSettings) {
    this.getSettings = getSettings; // () => profile.settings
    this.ctx = null;
    this.current = null;
    this.tracks = new Set();
    this.riserNodes = null;
    this.wanted = null; // the music that should play once audio is unlocked
    document.addEventListener("visibilitychange", () => (document.hidden ? this.suspend() : this.resume()));
  }

  /** Browsers only allow audio after a tap; call this from the first one. */
  unlock() {
    if (this.ctx) return this.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      // Safari: "ambient" makes the sound respect the device's silent switch (FEEL-05)
      if (navigator.audioSession) navigator.audioSession.type = "ambient";
    } catch (e) { /* not supported */ }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // noise for sound design only, never for outcomes
    this.applySettings();
    if (this.wanted) this.music(this.wanted);
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.getSettings();
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(s.muted ? 0 : s.musicVolume * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.muted ? 0 : s.sfxVolume, t, 0.05);
  }

  suspend() { if (this.ctx && this.ctx.state === "running") this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === "suspended" && !document.hidden) this.ctx.resume(); }

  // ---- building blocks ------------------------------------------------------------------------
  tone({ freq, type = "sine", dur = 0.15, vol = 0.3, when = 0, to = null, attack = 0.005, bus = "sfx" }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus === "music" ? this.musicBus : this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, freq = 1000, to = null, type = "bandpass", when = 0, q = 1 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // ---- sound effects --------------------------------------------------------------------------
  sfx(name, arg = 0) {
    if (!this.ctx) return;
    const T = this.tone.bind(this), N = this.noise.bind(this);
    switch (name) {
      case "tap": T({ freq: 620, dur: 0.07, vol: 0.18, type: "triangle" }); break;
      case "spin": N({ dur: 0.4, vol: 0.22, freq: 300, to: 1400 }); T({ freq: 110, to: 220, dur: 0.3, vol: 0.18, type: "sawtooth" }); break;
      case "stop": T({ freq: 150, to: 60, dur: 0.14, vol: 0.4, type: "triangle" }); N({ dur: 0.05, vol: 0.15, freq: 2000, type: "highpass" }); break;
      case "land-scatter": [880, 1319, 1760].forEach((f, i) => T({ freq: f, dur: 0.5, vol: 0.2, when: i * 0.06 })); break;
      case "land-wild": N({ dur: 0.45, vol: 0.14, freq: 500, to: 3500, q: 4 }); T({ freq: 520, to: 1040, dur: 0.35, vol: 0.15, type: "square" }); break;
      case "land-coin": T({ freq: 1760, dur: 0.18, vol: 0.2 }); T({ freq: 2349, dur: 0.3, vol: 0.16, when: 0.05 }); break;
      case "land-bonus": [523, 659, 784].forEach((f, i) => T({ freq: f, dur: 0.35, vol: 0.2, when: i * 0.08, type: "triangle" })); break;
      case "land-collect": T({ freq: 980, dur: 0.12, vol: 0.18, type: "triangle" }); T({ freq: 1470, dur: 0.18, vol: 0.14, when: 0.07, type: "triangle" }); break;
      case "win": { // arg 0..1 scales the arpeggio
        const base = [523, 659, 784, 1047, 1319];
        const n = 3 + Math.round(arg * 2);
        for (let i = 0; i < n; i++) T({ freq: base[i], dur: 0.28, vol: 0.2, when: i * 0.07, type: "triangle" });
        break;
      }
      case "tick": T({ freq: 900 + arg * 900, dur: 0.035, vol: 0.09, type: "square" }); break;
      case "sting": { // arg: 1 big, 2 mega, 3 epic
        const chord = [392, 494, 587, 784, 988, 1175];
        const n = 3 + arg;
        for (let i = 0; i < n; i++) T({ freq: chord[i] * (1 + arg * 0.0), dur: 0.9, vol: 0.18, type: "sawtooth", when: i * 0.04 });
        N({ dur: 0.6, vol: 0.18, freq: 400, to: 6000, q: 0.7 });
        T({ freq: 98, to: 49, dur: 0.7, vol: 0.5, type: "sine" });
        break;
      }
      case "jackpot": {
        const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093];
        seq.forEach((f, i) => { T({ freq: f, dur: 0.5, vol: 0.2, when: i * 0.13, type: "triangle" }); T({ freq: f / 2, dur: 0.5, vol: 0.12, when: i * 0.13, type: "sawtooth" }); });
        N({ dur: 1.4, vol: 0.2, freq: 300, to: 8000, q: 0.6 });
        break;
      }
      case "level": [523, 659, 784, 1047, 1319].forEach((f, i) => T({ freq: f, dur: 0.3, vol: 0.2, when: i * 0.08, type: "triangle" })); break;
      case "error": T({ freq: 110, dur: 0.2, vol: 0.25, type: "sawtooth" }); break;
      case "pip": T({ freq: 700 + arg * 120, dur: 0.1, vol: 0.2, type: "triangle" }); break;
      case "collect": T({ freq: 1200 + arg * 60, dur: 0.12, vol: 0.2 }); T({ freq: 1800 + arg * 60, dur: 0.16, vol: 0.14, when: 0.04 }); break;
      case "reveal": T({ freq: 440, to: 880, dur: 0.15, vol: 0.22, type: "triangle" }); break;
      case "pop": N({ dur: 0.18, vol: 0.2, freq: 1500, to: 400 }); T({ freq: 600, to: 200, dur: 0.15, vol: 0.2, type: "triangle" }); break;
      case "expand": N({ dur: 0.5, vol: 0.14, freq: 300, to: 3000, q: 3 }); T({ freq: 220, to: 880, dur: 0.5, vol: 0.2, type: "sawtooth" }); break;
      case "whoosh": N({ dur: 0.5, vol: 0.16, freq: 200, to: 2500 }); break;
    }
  }

  /** Rising anticipation sound while a feature is still possible (FEEL-01). */
  riser(on, ms = 1000) {
    if (!this.ctx) return;
    if (!on) {
      if (this.riserNodes) {
        const { o, g } = this.riserNodes, t = this.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0.0001, t, 0.04);
        o.stop(t + 0.25);
        this.riserNodes = null;
      }
      return;
    }
    if (this.riserNodes) return;
    const t = this.ctx.currentTime, dur = ms / 1000 + 0.4;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = "sawtooth"; f.type = "lowpass";
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(900, t + dur);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.2);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    this.riserNodes = { o, g };
  }

  // ---- music ----------------------------------------------------------------------------------
  music(name, shift = 0) {
    this.wanted = name;
    this.wantedShift = shift;
    if (!this.ctx) return;
    if (this.current && this.current.name === name + shift) return;
    const def = MUSIC[name];
    if (!def) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + 1.2);
    gain.connect(this.musicBus);
    const track = { name: name + shift, def, gain, shift, step: 0, next: t + 0.05, timer: null };
    track.timer = setInterval(() => this._schedule(track), 90);
    this._schedule(track);
    this.tracks.add(track);
    const old = this.current;
    this.current = track;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
      setTimeout(() => { clearInterval(old.timer); old.gain.disconnect(); this.tracks.delete(old); }, 1500);
    }
  }

  _schedule(track) {
    const { def } = track;
    const stepLen = 60 / def.bpm / 4;
    const bars = def.prog.length, total = bars * 16;
    while (track.next < this.ctx.currentTime + 0.35) {
      const i = track.step % total, bar = Math.floor(i / 16), s = i % 16;
      const root = def.root + track.shift + def.prog[bar] - (def.low ? 12 : 0);
      const third = def.minor ? 3 : 4;
      const tones = [0, third, 7, 12].map((x) => root + x);
      const when = track.next - this.ctx.currentTime;
      const note = (midi, dur, vol, wave) => this._musicNote(track, mtof(midi), dur, vol, wave, when);
      const arp = def.arp[s];
      if (arp !== null && arp !== undefined) note(tones[arp] + 12, stepLen * 1.8, 0.1, def.wave);
      if (s === 0 || s === 8) note(root - 12, stepLen * 6, 0.16 * def.bass, "sine");
      if (def.pad && s === 0) for (const m of tones.slice(0, 3)) note(m, stepLen * 15, 0.035, "triangle");
      if (def.hat && s % 2 === 1) this._hat(track, when, s % 4 === 3 ? 0.05 : 0.03);
      track.next += stepLen;
      track.step++;
    }
  }

  _musicNote(track, freq, dur, vol, wave, when) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(track.gain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _hat(track, when, vol) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf;
    f.type = "highpass"; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(track.gain);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.06);
  }
}
