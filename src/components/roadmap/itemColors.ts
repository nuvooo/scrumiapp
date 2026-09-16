/** Farben und Badges der Roadmap (Editor + Gesamtübersicht). */

/** Statusfarben der Übersichts-Balken (Tailwind-Klassen). */
export function barClasses(statusCategory: string | null): string {
  if (statusCategory === "done") return "border-[#2a4a33] bg-[#0e1d13] text-ok";
  if (statusCategory === "indeterminate") return "border-[#24404a] bg-[#0a1418] text-link";
  return "border-edge bg-chip text-mid";
}

export function typeBadge(item: { jiraKey: string | null; issueType: string | null }): string {
  if (!item.jiraKey) return "Ziel";
  return item.issueType?.toLowerCase() === "epic" ? "Epic" : "Ticket";
}

/** Feste Farbpalette für Labels und Meilensteine (zum Theme passend). */
export const ROADMAP_PALETTE = [
  "#4c9fc4", // blau
  "#5aa469", // grün
  "#c4574c", // rot
  "#c49a4c", // gelb
  "#8a6dc4", // violett
  "#4cb0a8", // türkis
  "#c47ba0", // rosa
  "#7f8896", // grau
] as const;

/** Farbtöne (HSL-Hue) für Blöcke; „erben" ist null. */
export const BLOCK_HUES: { hue: number; name: string }[] = [
  { hue: 212, name: "Blau" },
  { hue: 262, name: "Violett" },
  { hue: 318, name: "Magenta" },
  { hue: 168, name: "Türkis" },
  { hue: 140, name: "Grün" },
  { hue: 28, name: "Orange" },
  { hue: 0, name: "Rot" },
  { hue: 48, name: "Gelb" },
];

/** Farbtöne der Stream-Avatare, nach Stream-Index. */
export const LANE_HUES = [212, 150, 28, 300, 190, 60] as const;

export function laneHue(index: number): number {
  return LANE_HUES[index % LANE_HUES.length];
}

/** Hintergrund-/Textfarben der Fortschrittssegmente (inline styles, da dynamisch). */
export const PROGRESS_COLORS = {
  done: "#5aa469",
  inProgress: "#4c9fc4",
  open: "#3a3f47",
} as const;
