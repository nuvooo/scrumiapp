/**
 * Hintergrundbild des Retro-Boards: Der Moderator wählt ein Preset oder eine
 * Bild-URL, alle Teilnehmer sehen denselben Hintergrund. Presets sind
 * CSS-Gradients — kein externes Hosting nötig.
 */

export interface RetroBackgroundPreset {
  key: string;
  name: string;
  /** CSS background-image (Gradient). */
  css: string;
}

export const RETRO_BACKGROUNDS: RetroBackgroundPreset[] = [
  { key: "aurora", name: "Aurora", css: "linear-gradient(135deg, #0b1026 0%, #16324f 45%, #1b5e57 100%)" },
  { key: "sunset", name: "Sonnenuntergang", css: "linear-gradient(135deg, #1a0f1f 0%, #4a1e3c 50%, #8a3b2e 100%)" },
  { key: "ocean", name: "Ozean", css: "linear-gradient(160deg, #071a2b 0%, #0d3a54 55%, #14536b 100%)" },
  { key: "forest", name: "Wald", css: "linear-gradient(150deg, #0c1a12 0%, #1d3b25 55%, #2e5537 100%)" },
  { key: "lavender", name: "Lavendel", css: "linear-gradient(140deg, #141024 0%, #322153 55%, #54397c 100%)" },
];

const MAX_URL_LENGTH = 2000;

/** Erlaubt: leer (kein Hintergrund), Preset-Key oder http(s)-Bild-URL. */
export function isValidRetroBackground(value: string): boolean {
  if (value === "") return true;
  if (RETRO_BACKGROUNDS.some((p) => p.key === value)) return true;
  // Der URL-Parser wirft Tabs/Zeilenumbrüche stillschweigend raus — vorher ablehnen.
  if (value.length > MAX_URL_LENGTH || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** CSS background-image für den gespeicherten Wert (null = kein Hintergrund). */
export function retroBackgroundCss(value: string): string | null {
  if (value === "") return null;
  const preset = RETRO_BACKGROUNDS.find((p) => p.key === value);
  if (preset) return preset.css;
  if (!isValidRetroBackground(value)) return null;
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}
