// Tiny synthesized sound effects (no audio files to load) + spoken instructions.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNative } from './native';

let ctx: AudioContext | null = null;
let enabled = true;

export const setSoundEnabled = (on: boolean) => { enabled = on; };

function tone(freq: number, dur: number, type: OscillatorType = 'sine', at = 0, vol = 0.18) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}

export const sfx = {
  tap: () => tone(660, 0.08, 'triangle', 0, 0.12),
  pick: () => tone(520, 0.07, 'sine'),
  place: () => { tone(700, 0.08, 'triangle'); tone(990, 0.1, 'triangle', 0.06); },
  wrong: () => { tone(260, 0.14, 'sine', 0, 0.12); tone(220, 0.18, 'sine', 0.1, 0.1); },
  flip: () => tone(880, 0.05, 'square', 0, 0.05),
  hint: () => { tone(880, 0.1, 'sine'); tone(1175, 0.15, 'sine', 0.08); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', i * 0.11, 0.16)),
  coin: () => { tone(988, 0.07, 'square', 0, 0.07); tone(1319, 0.18, 'square', 0.07, 0.07); },
};

export function speak(text: string) {
  if (!enabled) return;
  // Android's WebView has no speechSynthesis, so use the device's native text-to-speech there.
  if (isNative) {
    void TextToSpeech.stop().catch(() => {}).then(() => TextToSpeech.speak({ text, lang: 'en-US', rate: 0.95, pitch: 1.15 })).catch(() => {});
    return;
  }
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}

export const stopSpeaking = () => {
  if (isNative) { void TextToSpeech.stop().catch(() => {}); return; }
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
};
