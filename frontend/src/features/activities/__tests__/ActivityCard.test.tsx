import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityCard } from "../components/ActivityCard";
import type { Activity } from "../types";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    title: "Peinture",
    description: "Atelier peinture aux doigts",
    date: "2026-09-04",
    start_time: "09:00:00",
    end_time: "10:00:00",
    category: "ART",
    category_label: "Arts plastiques",
    photos: [],
    participant_count: 3,
    created_at: "2026-09-04T09:00:00Z",
    ...overrides,
  };
}

describe("ActivityCard", () => {
  it("shows the title, category and participant count", () => {
    render(<ActivityCard activity={makeActivity()} />);

    expect(screen.getByText("Peinture")).toBeInTheDocument();
    expect(screen.getByText("Arts plastiques")).toBeInTheDocument();
    expect(screen.getByText("3 enfants")).toBeInTheDocument();
  });

  it("uses the singular for one participant", () => {
    render(<ActivityCard activity={makeActivity({ participant_count: 1 })} />);

    expect(screen.getByText("1 enfant")).toBeInTheDocument();
  });

  it("renders a time range without seconds", () => {
    render(<ActivityCard activity={makeActivity()} />);

    expect(screen.getByText("09:00 – 10:00")).toBeInTheDocument();
  });

  it("shows only the start when there is no end time", () => {
    render(<ActivityCard activity={makeActivity({ end_time: null })} />);

    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("omits the time entirely when none is set", () => {
    render(
      <ActivityCard
        activity={makeActivity({ start_time: null, end_time: null })}
      />,
    );

    expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument();
  });

  it("renders a cover photo when one exists", () => {
    render(
      <ActivityCard
        activity={makeActivity({
          photos: [
            {
              id: "p1",
              image_url: "https://x.test/a.jpg",
              thumbnail_url: "https://x.test/a_thumb.jpg",
              caption: "Les enfants peignent",
              order: 0,
            },
          ],
        })}
      />,
    );

    const image = screen.getByAltText("Les enfants peignent");
    expect(image).toHaveAttribute("src", "https://x.test/a_thumb.jpg");
  });

  it("renders no image element when there are no photos", () => {
    const { container } = render(<ActivityCard activity={makeActivity()} />);

    expect(container.querySelector("img")).toBeNull();
  });

  it("is a button only when it is clickable", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ActivityCard activity={makeActivity()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<ActivityCard activity={makeActivity()} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
