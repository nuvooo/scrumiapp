import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RoadmapMenu, icons, type MenuEntry } from "./RoadmapMenu";

afterEach(cleanup);

function entries(onProject: () => void, onArea: () => void): MenuEntry[] {
  return [
    { key: "project", icon: icons.layers, label: "Projekt", hint: "auf oberster Ebene", onSelect: onProject },
    { key: "area", icon: icons.rows, label: "Bereich", hint: "links einen Block anklicken", disabled: true, onSelect: onArea },
    { key: "sep", separator: true },
    { key: "legend", content: <span>Legende</span> },
  ];
}

describe("RoadmapMenu", () => {
  it("öffnet das Menü per Klick, zeigt Einträge mit Hinweis und schließt nach Auswahl", () => {
    const onProject = vi.fn();
    render(<RoadmapMenu trigger="Hinzufügen" triggerClassName="rm-btn" entries={entries(onProject, vi.fn())} />);

    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("auf oberster Ebene")).toBeTruthy();
    expect(screen.getByText("Legende")).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: /Projekt/ }));
    expect(onProject).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("deaktivierte Einträge lösen nichts aus", () => {
    const onArea = vi.fn();
    render(<RoadmapMenu trigger="Hinzufügen" triggerClassName="rm-btn" entries={entries(vi.fn(), onArea)} />);
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    const area = screen.getByRole("menuitem", { name: /Bereich/ }) as HTMLButtonElement;
    expect(area.disabled).toBe(true);
    fireEvent.click(area);
    expect(onArea).not.toHaveBeenCalled();
  });

  it("schließt mit Escape", () => {
    render(<RoadmapMenu trigger="Hinzufügen" triggerClassName="rm-btn" entries={entries(vi.fn(), vi.fn())} />);
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
