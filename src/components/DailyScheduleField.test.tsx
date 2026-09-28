import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DailyScheduleField } from "./DailyScheduleField";

const hiddenValue = (container: HTMLElement) =>
  JSON.parse((container.querySelector('input[name="dailySchedule"]') as HTMLInputElement).value);

afterEach(cleanup);

describe("DailyScheduleField", () => {
  it("gives each day its own time when series is off", () => {
    const { container } = render(<DailyScheduleField initial='{"1":"09:30","3":"11:00"}' />);

    // Unterschiedliche Uhrzeiten → Einzelmodus
    expect((screen.getByLabelText("Serie — gleiche Uhrzeit für alle Tage") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Daily-Uhrzeit Mi") as HTMLInputElement).value).toBe("11:00");

    fireEvent.click(screen.getByLabelText("Daily am Fr"));
    fireEvent.change(screen.getByLabelText("Daily-Uhrzeit Fr"), { target: { value: "08:45" } });

    expect(hiddenValue(container)).toEqual({ "1": "09:30", "3": "11:00", "5": "08:45" });
  });

  it("applies one time to all chosen days in series mode", () => {
    const { container } = render(<DailyScheduleField initial='{"1":"09:30","2":"09:30"}' />);

    expect((screen.getByLabelText("Serie — gleiche Uhrzeit für alle Tage") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Daily am Do"));
    fireEvent.change(screen.getByLabelText("Daily-Uhrzeit"), { target: { value: "10:15" } });

    expect(hiddenValue(container)).toEqual({ "1": "10:15", "2": "10:15", "4": "10:15" });
  });

  it("keeps the series time per day when switching series off", () => {
    const { container } = render(<DailyScheduleField initial='{"1":"09:30","2":"09:30"}' />);

    fireEvent.click(screen.getByLabelText("Serie — gleiche Uhrzeit für alle Tage"));
    fireEvent.change(screen.getByLabelText("Daily-Uhrzeit Di"), { target: { value: "13:00" } });

    expect(hiddenValue(container)).toEqual({ "1": "09:30", "2": "13:00" });
  });
});
