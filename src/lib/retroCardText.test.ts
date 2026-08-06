import { describe, it, expect } from "vitest";
import { cardSegments } from "./retroCardText";

describe("cardSegments", () => {
  it("reiner Text bleibt ein Textsegment", () => {
    expect(cardSegments("Mehr Pair Programming 🎉")).toEqual([
      { kind: "text", value: "Mehr Pair Programming 🎉" },
    ]);
  });

  it("erkennt GIF-URLs und rendert sie als Bild", () => {
    expect(cardSegments("Stimmung: https://media.giphy.com/media/abc/giphy.gif so!")).toEqual([
      { kind: "text", value: "Stimmung:" },
      { kind: "image", url: "https://media.giphy.com/media/abc/giphy.gif" },
      { kind: "text", value: "so!" },
    ]);
  });

  it("erkennt Bild-URLs mit Query-String", () => {
    expect(cardSegments("https://example.com/pic.png?size=200")).toEqual([
      { kind: "image", url: "https://example.com/pic.png?size=200" },
    ]);
  });

  it("normale Links bleiben Text", () => {
    expect(cardSegments("siehe https://example.com/docs")).toEqual([
      { kind: "text", value: "siehe https://example.com/docs" },
    ]);
  });

  it("mehrere Bilder in einer Karte", () => {
    const result = cardSegments("https://a.de/1.gif https://a.de/2.webp");
    expect(result).toEqual([
      { kind: "image", url: "https://a.de/1.gif" },
      { kind: "image", url: "https://a.de/2.webp" },
    ]);
  });
});
