// The sounds behind Routine alerts, made in the browser with the Web Audio
// API so there are no sound files to host or download. Browser-only; the
// choice of WHICH sound is in routineAlerts.ts (soundFor).
import type { SoundId } from "@/lib/routineAlerts";

type Spec = {
  notes: number[]; // Hz
  step: number; // seconds between notes
  length: number; // seconds each note rings
  type: OscillatorType;
  gain: number;
};

export const SOUND_SPECS: Record<SoundId, Spec> = {
  chime: { notes: [659.25, 880], step: 0.28, length: 0.9, type: "sine", gain: 0.4 }, // next activity
  arrival: { notes: [523.25, 783.99], step: 0.25, length: 0.9, type: "sine", gain: 0.4 }, // welcome
  meal: { notes: [784, 784, 784], step: 0.22, length: 0.7, type: "triangle", gain: 0.45 }, // dinner-bell ding ding ding
  nap: { notes: [523.25, 440, 392, 329.63], step: 0.55, length: 1.6, type: "sine", gain: 0.3 }, // slow lullaby fall
  outdoor: { notes: [523.25, 659.25, 783.99, 1046.5], step: 0.14, length: 0.5, type: "triangle", gain: 0.4 }, // bright climb
  wash: { notes: [1174.66, 1396.91, 1174.66], step: 0.16, length: 0.35, type: "sine", gain: 0.35 }, // water drops
  story: { notes: [392, 493.88, 587.33, 783.99], step: 0.3, length: 1.2, type: "sine", gain: 0.35 }, // gentle harp
  music: { notes: [523.25, 659.25, 523.25, 783.99, 659.25], step: 0.17, length: 0.5, type: "triangle", gain: 0.4 }, // playful
  art: { notes: [587.33, 739.99, 880], step: 0.22, length: 0.8, type: "triangle", gain: 0.4 }, // creative skip
  departure: { notes: [783.99, 659.25, 523.25, 392], step: 0.3, length: 1.1, type: "sine", gain: 0.4 }, // goodbye fall
  end: { notes: [880, 659.25, 523.25], step: 0.28, length: 0.9, type: "sine", gain: 0.4 }, // day finished
};

export function playSound(ctx: AudioContext, id: SoundId) {
  const spec = SOUND_SPECS[id] ?? SOUND_SPECS.chime;
  const t0 = ctx.currentTime + 0.02;
  spec.notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = freq;
    const start = t0 + i * spec.step;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(spec.gain, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + spec.length + 0.1);
  });
}
