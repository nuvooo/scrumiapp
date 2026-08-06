/**
 * Zerlegt Kartentext in Text- und Bildsegmente: direkte Bild-/GIF-URLs
 * (auch mit Query-String, z. B. Giphy-Links) werden im Board inline gerendert.
 */

const IMAGE_URL = /https?:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?\S*)?/gi;

export type CardSegment = { kind: "text"; value: string } | { kind: "image"; url: string };

export function cardSegments(text: string): CardSegment[] {
  const segments: CardSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(IMAGE_URL)) {
    const start = match.index ?? 0;
    const before = text.slice(last, start);
    if (before.trim() !== "") segments.push({ kind: "text", value: before.trim() });
    segments.push({ kind: "image", url: match[0] });
    last = start + match[0].length;
  }
  const rest = text.slice(last);
  if (rest.trim() !== "") segments.push({ kind: "text", value: rest.trim() });
  return segments;
}
