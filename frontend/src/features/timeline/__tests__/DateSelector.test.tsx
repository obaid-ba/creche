import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DateSelector,
  describeDate,
  toISODate,
  todayISO,
} from "../components/DateSelector";

// Fixed local noon so the "today" maths cannot drift across a midnight
// boundary while the suite runs.
const NOW = new Date(2026, 8, 4, 12, 0, 0);

describe("date helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("formats a local date without shifting the day", () => {
    // A late-evening local time must not roll over via UTC.
    expect(toISODate(new Date(2026, 8, 4, 23, 30))).toBe("2026-09-04");
  });

  it("labels today and yesterday", () => {
    expect(describeDate("2026-09-04")).toBe("Aujourd'hui");
    expect(describeDate("2026-09-03")).toBe("Hier");
  });

  it("writes older dates out in French", () => {
    expect(describeDate("2026-09-01")).toMatch(/septembre/);
  });

  it("todayISO agrees with the fake clock", () => {
    expect(todayISO()).toBe("2026-09-04");
  });
});

describe("DateSelector", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("steps back a day", async () => {
    const onChange = vi.fn();
    render(<DateSelector value="2026-09-04" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /jour précédent/i }));

    expect(onChange).toHaveBeenCalledWith("2026-09-03");
  });

  it("steps forward a day when not already on today", async () => {
    const onChange = vi.fn();
    render(<DateSelector value="2026-09-02" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /jour suivant/i }));

    expect(onChange).toHaveBeenCalledWith("2026-09-03");
  });

  it("cannot move past today, because a nursery day is never in the future", () => {
    render(<DateSelector value="2026-09-04" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /jour suivant/i })).toBeDisabled();
  });

  it("offers a shortcut back to today only when away from it", () => {
    const { rerender } = render(
      <DateSelector value="2026-09-04" onChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Aujourd'hui" }),
    ).not.toBeInTheDocument();

    rerender(<DateSelector value="2026-09-01" onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Aujourd'hui" }),
    ).toBeInTheDocument();
  });

  it("caps the date picker at today", () => {
    render(<DateSelector value="2026-09-04" onChange={vi.fn()} />);

    expect(screen.getByLabelText(/choisir une date/i)).toHaveAttribute(
      "max",
      "2026-09-04",
    );
  });
});
