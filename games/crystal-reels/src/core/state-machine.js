// Spin state machine (REEL-06): one source of truth for what the player may do right now.
// Each state accepts a fixed set of inputs; everything else is ignored, never queued.
//
//   Idle -> Spinning -> Stopping -> Evaluating -> Presenting -> (Feature) -> Idle
//
// The result of a spin is decided at the tap (MATH-01); every state after Idle is presentation.

export const STATES = ["idle", "spinning", "stopping", "evaluating", "presenting", "feature"];

export const ACCEPTS = {
  idle: ["spin", "bet", "autoplay", "turbo", "nav", "menu", "info", "mute", "quest"],
  spinning: ["slam", "spin", "stopAuto", "turbo", "mute"],
  stopping: ["slam", "spin", "stopAuto", "mute"],
  evaluating: ["stopAuto", "mute"],
  presenting: ["skip", "spin", "stopAuto", "turbo", "mute"],
  feature: ["featureInput", "stopAuto", "mute"],
};

const NEXT = {
  idle: ["spinning", "feature"], // a free-spin voucher starts a feature without a spin
  spinning: ["stopping"],
  stopping: ["evaluating"],
  evaluating: ["presenting"],
  presenting: ["feature", "idle"],
  feature: ["idle", "presenting"],
};

export class SpinStateMachine {
  constructor(state = "idle") {
    if (!STATES.includes(state)) throw new Error("Unknown state " + state);
    this.state = state;
    this.listeners = [];
  }
  /** True when `input` is allowed in the current state. */
  accepts(input) { return ACCEPTS[this.state].includes(input); }
  /** Returns true when the input was accepted; a refused input is simply dropped. */
  handle(input) { return this.accepts(input); }
  to(next) {
    if (!NEXT[this.state].includes(next)) throw new Error(`Illegal transition ${this.state} -> ${next}`);
    const from = this.state;
    this.state = next;
    for (const l of this.listeners) l(next, from);
  }
  /** Jump straight to a state: only for resuming after the app was closed (PERS-02). */
  resumeAt(state) {
    if (!STATES.includes(state)) throw new Error("Unknown state " + state);
    const from = this.state;
    this.state = state;
    for (const l of this.listeners) l(state, from);
  }
  /** Back to Idle from anywhere (used when a spin is resumed after an interruption). */
  reset() {
    const from = this.state;
    this.state = "idle";
    if (from !== "idle") for (const l of this.listeners) l("idle", from);
  }
  onChange(fn) { this.listeners.push(fn); }
  toJSON() { return { state: this.state }; }
  static from(json) { return new SpinStateMachine(json && STATES.includes(json.state) ? json.state : "idle"); }
}
