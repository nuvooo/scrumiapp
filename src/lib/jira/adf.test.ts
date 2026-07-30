import { describe, it, expect } from "vitest";
import { adfToText } from "./adf";

describe("adfToText", () => {
  it("extrahiert Text aus verschachtelten ADF-Knoten mit Absätzen", () => {
    const adf = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Als Benutzer möchte ich" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Punkt eins" }] }] },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Als Benutzer möchte ich\nPunkt eins");
  });

  it("liefert leeren String für null/ungültige Eingaben", () => {
    expect(adfToText(null)).toBe("");
    expect(adfToText(undefined)).toBe("");
    expect(adfToText("kein adf")).toBe("");
  });

  it("kürzt lange Texte auf das Limit", () => {
    const adf = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(1000) }] }] };
    expect(adfToText(adf, 100)).toHaveLength(101); // 100 + Ellipse
    expect(adfToText(adf, 100).endsWith("…")).toBe(true);
  });
});
