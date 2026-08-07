import { describe, expect, it } from "vitest";
import { RETRO_BACKGROUNDS, isValidRetroBackground, retroBackgroundCss } from "./retroBackground";

describe("isValidRetroBackground", () => {
  it("akzeptiert leer (kein Hintergrund)", () => {
    expect(isValidRetroBackground("")).toBe(true);
  });

  it("akzeptiert alle Preset-Keys", () => {
    for (const preset of RETRO_BACKGROUNDS) {
      expect(isValidRetroBackground(preset.key)).toBe(true);
    }
  });

  it("akzeptiert http(s)-URLs", () => {
    expect(isValidRetroBackground("https://example.com/bild.jpg")).toBe(true);
    expect(isValidRetroBackground("http://example.com/bild.png")).toBe(true);
  });

  it("lehnt andere Protokolle und Nicht-URLs ab", () => {
    expect(isValidRetroBackground("javascript:alert(1)")).toBe(false);
    expect(isValidRetroBackground("file:///etc/passwd")).toBe(false);
    expect(isValidRetroBackground("kein-preset")).toBe(false);
  });

  it("lehnt URLs mit Whitespace ab (der URL-Parser würde ihn verschlucken)", () => {
    expect(isValidRetroBackground("https://exa\nmple.com/b.jpg")).toBe(false);
    expect(isValidRetroBackground("https://example.com/a b.jpg")).toBe(false);
  });

  it("lehnt überlange URLs ab", () => {
    expect(isValidRetroBackground(`https://example.com/${"a".repeat(2100)}`)).toBe(false);
  });
});

describe("retroBackgroundCss", () => {
  it("liefert null ohne Hintergrund", () => {
    expect(retroBackgroundCss("")).toBeNull();
  });

  it("liefert den Gradient eines Presets", () => {
    expect(retroBackgroundCss("aurora")).toBe(RETRO_BACKGROUNDS[0].css);
  });

  it("verpackt URLs in url(...) mit escapten Anführungszeichen", () => {
    expect(retroBackgroundCss("https://example.com/bild.jpg")).toBe('url("https://example.com/bild.jpg")');
    expect(retroBackgroundCss('https://example.com/a"b.jpg')).toBe('url("https://example.com/a\\"b.jpg")');
  });

  it("liefert null für ungültige Werte", () => {
    expect(retroBackgroundCss("javascript:alert(1)")).toBeNull();
  });
});
