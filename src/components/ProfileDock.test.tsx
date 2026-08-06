import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { ProfileDock, onProfileSaved, storedProfile } from "./ProfileDock";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const seedProfile = (over: Record<string, string> = {}) =>
  window.localStorage.setItem(
    "scrumi.profile",
    JSON.stringify({ name: "Ben", avatar: "🦊", refinementRole: "estimator", retroRole: "member", ...over }),
  );

describe("ProfileDock", () => {
  it("zeigt Avatar, Name und beide Rollen als Chip", () => {
    seedProfile();
    render(<ProfileDock />);
    const chip = screen.getByRole("button", { name: "Profil bearbeiten" });
    expect(chip).toHaveTextContent("🦊");
    expect(chip).toHaveTextContent("Ben");
    expect(chip).toHaveTextContent("Schätzer · Teilnehmer");
  });

  it("ohne Profil lädt der Chip zum Anlegen ein", () => {
    render(<ProfileDock />);
    expect(screen.getByRole("button", { name: "Profil bearbeiten" })).toHaveTextContent("Dein Profil");
  });

  it("speichert Name, Avatar und beide Rollen und benachrichtigt Räume", () => {
    seedProfile();
    const saved = vi.fn();
    const unsubscribe = onProfileSaved(saved);
    render(<ProfileDock />);
    fireEvent.click(screen.getByRole("button", { name: "Profil bearbeiten" }));

    fireEvent.change(screen.getByLabelText("Dein Name"), { target: { value: "Benji" } });
    fireEvent.click(screen.getByRole("button", { name: "Avatar 🐼" }));
    const refinementSection = screen.getByRole("group", { name: "Rolle im Refinement" });
    fireEvent.click(within(refinementSection).getByRole("radio", { name: /Besucher/ }));
    const retroSection = screen.getByRole("group", { name: "Rolle im Retro" });
    fireEvent.click(within(retroSection).getByRole("radio", { name: /Moderator/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(saved).toHaveBeenCalledWith({
      name: "Benji",
      avatar: "🐼",
      refinementRole: "visitor",
      retroRole: "moderator",
    });
    expect(storedProfile()).toEqual({ name: "Benji", avatar: "🐼", refinementRole: "visitor", retroRole: "moderator" });
    // Chip zeigt den neuen Stand
    expect(screen.getByRole("button", { name: "Profil bearbeiten" })).toHaveTextContent("Benji");
    unsubscribe();
  });
});
