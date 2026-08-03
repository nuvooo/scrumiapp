import { describe, it, expect } from "vitest";
import { passwordHash, configuredPassword } from "./auth";

describe("passwordHash", () => {
  it("berechnet den SHA-256-Hex-Hash", async () => {
    // Bekannter Testvektor für "abc"
    expect(await passwordHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Passwörter", async () => {
    expect(await passwordHash("geheim")).not.toBe(await passwordHash("anders"));
  });
});

describe("configuredPassword", () => {
  it("liefert leeren String, wenn APP_PASSWORD nicht gesetzt ist", () => {
    delete process.env.APP_PASSWORD;
    expect(configuredPassword()).toBe("");
  });

  it("schneidet Leerzeichen ab", () => {
    process.env.APP_PASSWORD = "  geheim  ";
    expect(configuredPassword()).toBe("geheim");
    delete process.env.APP_PASSWORD;
  });
});
