import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import confetti from "canvas-confetti";
import { Celebration } from "./Celebration";

const confettiMock = vi.mocked(confetti);

describe("Celebration", () => {
  beforeEach(() => {
    confettiMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires confetti bursts for the confetti effect", () => {
    render(<Celebration effect="confetti" />);
    expect(confettiMock).toHaveBeenCalledTimes(3);
  });

  it("fires repeated bursts for the fireworks effect", () => {
    render(<Celebration effect="fireworks" />);
    vi.advanceTimersByTime(1000);
    expect(confettiMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("stops the fireworks after ~3 seconds", () => {
    render(<Celebration effect="fireworks" />);
    vi.advanceTimersByTime(5000);
    const calls = confettiMock.mock.calls.length;
    vi.advanceTimersByTime(2000);
    expect(confettiMock.mock.calls.length).toBe(calls);
  });

  it("does nothing for effect null", () => {
    render(<Celebration effect={null} />);
    vi.advanceTimersByTime(4000);
    expect(confettiMock).not.toHaveBeenCalled();
  });
});
