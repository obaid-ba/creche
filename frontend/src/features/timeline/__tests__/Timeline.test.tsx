import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Timeline } from "../components/Timeline";
import type { TimelineEvent } from "../types";

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "e1",
    type: "BOTTLE",
    label: "Biberon",
    icon: "milk",
    group: "meals",
    occurred_at: "2026-09-04T08:15:00Z",
    ended_at: null,
    local_date: "2026-09-04",
    duration_minutes: null,
    is_open_interval: false,
    title: "",
    description: "",
    data: { volume_ml: 180 },
    activity: null,
    is_published: true,
    created_by: null,
    created_at: "2026-09-04T08:20:00Z",
    ...overrides,
  };
}

describe("Timeline", () => {
  it("renders an empty state when there is nothing to show", () => {
    render(<Timeline events={[]} />);

    expect(screen.getByText("Journée vide")).toBeInTheDocument();
  });

  it("uses the supplied empty message", () => {
    render(
      <Timeline
        events={[]}
        emptyMessage="La journée n'a pas encore été publiée."
      />,
    );

    expect(
      screen.getByText("La journée n'a pas encore été publiée."),
    ).toBeInTheDocument();
  });

  it("renders events as an ordered list, preserving server order", () => {
    render(
      <Timeline
        events={[
          makeEvent({ id: "a", label: "Biberon" }),
          makeEvent({ id: "b", label: "Déjeuner", type: "MEAL", data: {} }),
          makeEvent({ id: "c", label: "Sommeil", type: "SLEEP", data: {} }),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0] as HTMLElement).getByText("Biberon")).toBeInTheDocument();
    expect(within(items[2] as HTMLElement).getByText("Sommeil")).toBeInTheDocument();
  });

  it("shows the event time as a machine-readable <time>", () => {
    const { container } = render(
      <Timeline events={[makeEvent({ occurred_at: "2026-09-04T08:15:00Z" })]} />,
    );

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", "2026-09-04T08:15:00Z");
  });

  it("marks an in-progress nap and offers to end it", async () => {
    const onEnd = vi.fn();
    render(
      <Timeline
        events={[
          makeEvent({
            id: "s1",
            type: "SLEEP",
            label: "Sommeil",
            data: {},
            is_open_interval: true,
          }),
        ]}
        onEnd={onEnd}
      />,
    );

    expect(screen.getByText("En cours")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /terminer/i }));
    expect(onEnd).toHaveBeenCalledWith("s1");
  });

  it("does not offer to end a completed event", () => {
    render(
      <Timeline
        events={[
          makeEvent({
            type: "SLEEP",
            data: {},
            is_open_interval: false,
            duration_minutes: 75,
          }),
        ]}
        onEnd={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /terminer/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Durée : 1h15")).toBeInTheDocument();
  });

  it("hides the end button entirely for a parent (no onEnd handler)", () => {
    render(
      <Timeline
        events={[makeEvent({ type: "SLEEP", data: {}, is_open_interval: true })]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /terminer/i }),
    ).not.toBeInTheDocument();
  });

  it("credits the staff member who recorded the event", () => {
    render(
      <Timeline
        events={[
          makeEvent({
            created_by: { id: "u1", first_name: "Amina", last_name: "Sassi" },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Par Amina")).toBeInTheDocument();
  });
});
