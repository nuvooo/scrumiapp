import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BurndownTabs } from "./BurndownTabs";

afterEach(cleanup);

describe("BurndownTabs", () => {
  it("preselects the Tickets tab", () => {
    render(<BurndownTabs ticketRows={[]} storyRows={[]} />);
    expect(screen.getByRole("tab", { name: "Tickets" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Story Points" })).toHaveAttribute("aria-selected", "false");
  });

  it("shows the ticket empty-state by default", () => {
    render(<BurndownTabs ticketRows={[]} storyRows={[]} />);
    expect(screen.getByText("Für diesen Sprint wurden noch keine Ticket-Daten erfasst.")).toBeInTheDocument();
  });

  it("switches to the story-points view when its tab is clicked", () => {
    render(<BurndownTabs ticketRows={[]} storyRows={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Story Points" }));
    expect(screen.getByRole("tab", { name: "Story Points" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Dieser Sprint hat noch keine Burndown-Punkte.")).toBeInTheDocument();
  });
});
