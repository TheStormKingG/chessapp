/**
 * Move sounds, synthesised.
 *
 * Nothing is downloaded and no file ships. Two reasons, both binding:
 *
 *  - PRD Appendix D forbids copying chess.com's or Lichess's assets, and their
 *    move sounds are exactly that kind of asset.
 *  - The shell budget has ~61 KiB of headroom (PRD 11). A set of sampled move
 *    sounds is tens of KiB for something a learner hears and never looks at.
 *
 * Synthesis costs bytes only as code, and this is under 2 KB.
 *
 * The palette is deliberately dull. A move is heard hundreds of times in a
 * session, so it has to survive repetition: a short, soft wooden knock, not a
 * chime. Anything with pitch or melody becomes unbearable by the twentieth
 * repeat, which is the same frequency argument that governs animation.
 */

export type MoveSoundKind = 'move' | 'capture' | 'check';

let ctx: AudioContext | null = null;

/**
 * The context is created on demand, inside the gesture that plays the first
 * sound. Browsers refuse to start audio without one, and a context created at
 * import time arrives `suspended` and stays that way.
 */
function context(): AudioContext | null {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    // No Web Audio (old browser, blocked context). Silence is an acceptable
    // outcome for a decorative cue; nothing else may fail because of it.
    return null;
  }
}

/** A short burst of filtered noise: the body of a piece landing on a board. */
function knock(c: AudioContext, at: number, level: number, cutoff: number, decay: number): void {
  const frames = Math.floor(c.sampleRate * decay);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Exponential decay, so it reads as a knock rather than a hiss.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;

  const gain = c.createGain();
  gain.gain.value = level;

  src.connect(lp).connect(gain).connect(c.destination);
  src.start(at);
  src.stop(at + decay);
}

/** A soft sine thump under the knock, which is what makes it sound like wood. */
function body(c: AudioContext, at: number, freq: number, level: number, decay: number): void {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + decay);

  const gain = c.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);

  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + decay);
}

/**
 * Play one move cue. Never throws: a decorative sound must not be able to break
 * a lesson, so every failure path ends in silence.
 */
export function playMoveSound(kind: MoveSoundKind): void {
  const c = context();
  if (!c) return;
  try {
    const t = c.currentTime;
    switch (kind) {
      case 'capture':
        // Harder and lower than a move: something was taken off the board.
        knock(c, t, 0.16, 2600, 0.07);
        body(c, t, 150, 0.1, 0.1);
        break;
      case 'check':
        // The only cue with two events, because check is the only one that
        // carries a warning rather than a fact.
        knock(c, t, 0.12, 3200, 0.05);
        body(c, t, 220, 0.08, 0.07);
        body(c, t + 0.085, 330, 0.07, 0.09);
        break;
      default:
        knock(c, t, 0.1, 3000, 0.045);
        body(c, t, 190, 0.07, 0.07);
    }
  } catch {
    /* silence */
  }
}

/** Test seam: forget the context so a fresh one is built next time. */
export function __resetAudioForTest(): void {
  ctx = null;
}
