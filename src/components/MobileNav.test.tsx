import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MobileNav } from "./MobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/standup",
  useSearchParams: () => new URLSearchParams("team=t1"),
}));

afterEach(cleanup);

describe("MobileNav", () => {
  it("öffnet das Menü über den Burger-Button", () => {
    render(<MobileNav jiraHost="x.atlassian.net" />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("verbunden")).toBeInTheDocument();
  });

  it("markiert den aktiven Eintrag und hängt den Query-String an", () => {
    render(<MobileNav jiraHost={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const active = screen.getByRole("link", { name: "Standup" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard?team=t1",
    );
  });

  it("schließt über Link-Klick, Hintergrund und Escape", () => {
    render(<MobileNav jiraHost={null} />);
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));

    open();
    fireEvent.click(screen.getByRole("link", { name: "Burndown" }));
    expect(screen.queryByRole("link", { name: "Burndown" })).not.toBeInTheDocument();

    open();
    fireEvent.click(screen.getByRole("button", { name: "Menü schließen" }));
    expect(screen.queryByRole("link", { name: "Burndown" })).not.toBeInTheDocument();

    open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Burndown" })).not.toBeInTheDocument();
  });
});
