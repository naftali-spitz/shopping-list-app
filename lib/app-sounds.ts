let audioContext: AudioContext | null = null;

export type AppSound =
  | "tap"
  | "open"
  | "add"
  | "remove"
  | "quantity"
  | "success"
  | "delete"
  | "toggle";

type Tone = {
  type: OscillatorType;
  startFrequency: number;
  endFrequency: number;
  startOffset: number;
  duration: number;
  gain: number;
};

type SoundPreset = {
  volume: number;
  attack: number;
  release: number;
  filter: number;
  echoDelay: number;
  echoGain: number;
  feedbackGain: number;
  tones: Tone[];
};

const presets: Record<AppSound, SoundPreset> = {
  tap: {
    volume: 0.1,
    attack: 0.01,
    release: 0.14,
    filter: 460,
    echoDelay: 0.038,
    echoGain: 0.14,
    feedbackGain: 0.16,
    tones: [
      { type: "triangle", startFrequency: 720, endFrequency: 1280, startOffset: 0, duration: 0.075, gain: 0.75 },
    ],
  },
  open: {
    volume: 0.12,
    attack: 0.012,
    release: 0.2,
    filter: 360,
    echoDelay: 0.055,
    echoGain: 0.16,
    feedbackGain: 0.18,
    tones: [
      { type: "sine", startFrequency: 420, endFrequency: 760, startOffset: 0, duration: 0.09, gain: 0.65 },
      { type: "triangle", startFrequency: 820, endFrequency: 1320, startOffset: 0.035, duration: 0.085, gain: 0.45 },
    ],
  },
  add: {
    volume: 0.12,
    attack: 0.01,
    release: 0.18,
    filter: 420,
    echoDelay: 0.045,
    echoGain: 0.16,
    feedbackGain: 0.2,
    tones: [
      { type: "triangle", startFrequency: 620, endFrequency: 1320, startOffset: 0, duration: 0.08, gain: 0.7 },
      { type: "sine", startFrequency: 1180, endFrequency: 1880, startOffset: 0.03, duration: 0.075, gain: 0.45 },
    ],
  },
  remove: {
    volume: 0.11,
    attack: 0.008,
    release: 0.16,
    filter: 380,
    echoDelay: 0.04,
    echoGain: 0.11,
    feedbackGain: 0.12,
    tones: [
      { type: "triangle", startFrequency: 980, endFrequency: 430, startOffset: 0, duration: 0.1, gain: 0.72 },
      { type: "sine", startFrequency: 620, endFrequency: 360, startOffset: 0.025, duration: 0.09, gain: 0.36 },
    ],
  },
  quantity: {
    volume: 0.1,
    attack: 0.007,
    release: 0.12,
    filter: 500,
    echoDelay: 0.032,
    echoGain: 0.12,
    feedbackGain: 0.12,
    tones: [
      { type: "square", startFrequency: 880, endFrequency: 1220, startOffset: 0, duration: 0.045, gain: 0.25 },
      { type: "triangle", startFrequency: 1220, endFrequency: 1560, startOffset: 0.035, duration: 0.055, gain: 0.4 },
    ],
  },
  success: {
    volume: 0.12,
    attack: 0.012,
    release: 0.28,
    filter: 360,
    echoDelay: 0.06,
    echoGain: 0.18,
    feedbackGain: 0.2,
    tones: [
      { type: "sine", startFrequency: 520, endFrequency: 820, startOffset: 0, duration: 0.09, gain: 0.48 },
      { type: "triangle", startFrequency: 820, endFrequency: 1320, startOffset: 0.07, duration: 0.1, gain: 0.55 },
      { type: "sine", startFrequency: 1320, endFrequency: 1760, startOffset: 0.14, duration: 0.11, gain: 0.38 },
    ],
  },
  delete: {
    volume: 0.12,
    attack: 0.006,
    release: 0.2,
    filter: 300,
    echoDelay: 0.045,
    echoGain: 0.1,
    feedbackGain: 0.1,
    tones: [
      { type: "sawtooth", startFrequency: 760, endFrequency: 260, startOffset: 0, duration: 0.14, gain: 0.22 },
      { type: "triangle", startFrequency: 460, endFrequency: 220, startOffset: 0.04, duration: 0.12, gain: 0.42 },
    ],
  },
  toggle: {
    volume: 0.1,
    attack: 0.008,
    release: 0.13,
    filter: 520,
    echoDelay: 0.034,
    echoGain: 0.12,
    feedbackGain: 0.12,
    tones: [
      { type: "triangle", startFrequency: 760, endFrequency: 1480, startOffset: 0, duration: 0.055, gain: 0.55 },
      { type: "triangle", startFrequency: 1480, endFrequency: 920, startOffset: 0.052, duration: 0.055, gain: 0.38 },
    ],
  },
};

function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor =
    window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  audioContext ??= new AudioContextConstructor();

  return audioContext;
}

export async function playAppSound(sound: AppSound = "tap") {
  const context = getAudioContext();

  if (!context) return;

  if (context.state === "suspended") {
    await context.resume();
  }

  const preset = presets[sound] ?? presets.tap;
  const now = context.currentTime;
  const masterGain = context.createGain();
  const delay = context.createDelay();
  const feedback = context.createGain();
  const echoGain = context.createGain();
  const highPass = context.createBiquadFilter();

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(preset.volume, now + preset.attack);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + preset.release);

  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(preset.filter, now);

  delay.delayTime.setValueAtTime(preset.echoDelay, now);
  feedback.gain.setValueAtTime(preset.feedbackGain, now);
  echoGain.gain.setValueAtTime(preset.echoGain, now);

  masterGain.connect(highPass);
  highPass.connect(context.destination);
  masterGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(echoGain);
  echoGain.connect(highPass);

  preset.tones.forEach((tone) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    const start = now + tone.startOffset;
    const end = start + tone.duration;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);

    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.01);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(voiceGain);
    voiceGain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}
