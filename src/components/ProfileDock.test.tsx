import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProfileDock } from "./ProfileDock";

afterEach(cleanup);

const roles = [
  { value: "member", label: "Teilnehmer", hint: "schreibt Karten" },
  { value: "moderator", label: "Moderator", hint: "moderiert" },
];

describe("ProfileDock", () => {
  it("zeigt Avatar, Name und Rolle als Chip", () => {
    render(<ProfileDock name="Ben" avatar="🦊" role="member" roles={roles} onSave={() => {}} />);
    const chip = screen.getByRole("button", { name: "Profil bearbeiten" });
    expect(chip).toHaveTextContent("🦊");
    expect(chip).toHaveTextContent("Ben");
    expect(chip).toHaveTextContent("Teilnehmer");
  });

  it("öffnet den Editor und speichert Name, Avatar und Rolle", () => {
    const onSave = vi.fn();
    render(<ProfileDock name="Ben" avatar="" role="member" roles={roles} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Profil bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Dein Name"), { target: { value: "Benji" } });
    fireEvent.click(screen.getByRole("button", { name: "Avatar 🦊" }));
    fireEvent.click(screen.getByRole("radio", { name: /Moderator/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSave).toHaveBeenCalledWith("Benji", "🦊", "moderator");
    // Editor schließt sich, Chip ist wieder da
    expect(screen.getByRole("button", { name: "Profil bearbeiten" })).toBeInTheDocument();
  });

  it("merkt sich Name und Avatar für die Beitritts-Vorbelegung", () => {
    render(<ProfileDock name="Ben" avatar="" role="member" roles={roles} onSave={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Profil bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Dein Name"), { target: { value: "Benji" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(JSON.parse(window.localStorage.getItem("scrumi.profile") ?? "{}")).toEqual({ name: "Benji", avatar: "" });
  });
});
