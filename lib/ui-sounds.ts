export type UiSoundType = "click" | "success" | "delete" | "error";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  audioContext ??= new AudioContextConstructor();

  return audioContext;
}

function getSoundConfig(type: UiSoundType) {
  switch (type) {
    case "success":
      return {
        frequencies: [760, 1180, 1640],
        duration: 0.16,
        volume: 0.12,
      };
    case "delete":
      return {
        frequencies: [520, 320],
        duration: 0.18,
        volume: 0.13,
      };
    case "error":
      return {
        frequencies: [220, 180, 260],
        duration: 0.22,
        volume: 0.14,
      };
    case "click":
    default:
      return {
        frequencies: [620, 1480],
        duration: 0.12,
        volume: 0.11,
      };
  }
}

export async function playUiSound(type: UiSoundType = "click") {
  const context = getAudioContext();

  if (!context) return;

  if (context.state === "suspended") {
    await context.resume();
  }

  const now = context.currentTime;
  const { frequencies, duration, volume } = getSoundConfig(type);
  const masterGain = context.createGain();
  const filter = context.createBiquadFilter();
  const delay = context.createDelay();
  const echoGain = context.createGain();

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  filter.type = type === "delete" || type === "error" ? "lowpass" : "highpass";
  filter.frequency.setValueAtTime(type === "delete" ? 900 : 420, now);

  delay.delayTime.setValueAtTime(0.045, now);
  echoGain.gain.setValueAtTime(type === "error" ? 0.06 : 0.14, now);

  masterGain.connect(filter);
  filter.connect(context.destination);
  masterGain.connect(delay);
  delay.connect(echoGain);
  echoGain.connect(filter);

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    const start = now + index * 0.035;
    const end = start + Math.max(0.06, duration - index * 0.025);

    oscillator.type = type === "error" ? "sawtooth" : type === "delete" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);

    if (type === "click" || type === "success") {
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, end);
    } else {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.8), end);
    }

    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.exponentialRampToValueAtTime(1 / frequencies.length, start + 0.01);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(voiceGain);
    voiceGain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}
