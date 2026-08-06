/**
 * Sanfte generative Hintergrundmusik für die Retro — komplett im Browser
 * per WebAudio erzeugt (Lofi-Akkordfläche plus zufällige Pentatonik-Melodie).
 * Keine Audiodatei, keine Lizenzfragen, kein externer Stream. Startet nur
 * auf Nutzer-Klick (Autoplay-Regeln der Browser).
 */

/** Akkordfolge: Fmaj7 → Am7 → Dm7 → G7 (MIDI-Noten). */
const CHORDS = [
  [53, 57, 60, 64],
  [57, 60, 64, 67],
  [50, 53, 57, 60],
  [55, 59, 62, 65],
];

/** A-Moll-Pentatonik für die Melodie-Tupfer. */
const PENTATONIC = [69, 72, 74, 76, 79, 81];

const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class AmbientMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private chordTimer: number | undefined;
  private pluckTimer: number | undefined;
  private step = 0;

  static supported(): boolean {
    return typeof window !== "undefined" && "AudioContext" in window;
  }

  start(): void {
    if (this.ctx || !AmbientMusic.supported()) return;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.14;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    master.connect(filter);
    filter.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    this.playChord();
    this.chordTimer = window.setInterval(() => this.playChord(), 4800);
    this.pluckTimer = window.setInterval(() => {
      if (Math.random() < 0.6) this.playPluck();
    }, 620);
  }

  stop(): void {
    window.clearInterval(this.chordTimer);
    window.clearInterval(this.pluckTimer);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }

  get playing(): boolean {
    return this.ctx !== null;
  }

  /** Weiche Akkordfläche: langsamer Attack, langes Ausklingen. */
  private playChord(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const chord = CHORDS[this.step++ % CHORDS.length];
    for (const midi of chord) {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiToFreq(midi);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 1.4);
      gain.gain.linearRampToValueAtTime(0, t + 4.7);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 5);
    }
  }

  /** Kurzer Melodie-Tupfer aus der Pentatonik. */
  private playPluck(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const midi = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midiToFreq(midi);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 1);
  }
}
