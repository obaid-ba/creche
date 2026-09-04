import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ChildCard } from "../components/ChildCard";
import type { ChildListItem } from "../types";

function makeChild(overrides: Partial<ChildListItem> = {}): ChildListItem {
  return {
    id: "c1",
    first_name: "Mohamed",
    last_name: "Benali",
    full_name: "Mohamed Benali",
    date_of_birth: "2024-03-15",
    age_months: 29,
    age_display: "2 ans et 5 mois",
    age_group: { key: "PRESCHOOL", label: "2 ans et +" },
    gender: "M",
    photo_url: null,
    status: "ACTIVE",
    allergies: "",
    ...overrides,
  };
}

function renderCard(child: ChildListItem) {
  return render(
    <MemoryRouter>
      <ChildCard child={child} />
    </MemoryRouter>,
  );
}

describe("ChildCard", () => {
  it("shows the name and computed age", () => {
    renderCard(makeChild());

    expect(screen.getByText("Mohamed Benali")).toBeInTheDocument();
    expect(screen.getByText("2 ans et 5 mois")).toBeInTheDocument();
  });

  it("links to the child's profile", () => {
    renderCard(makeChild());

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/staff/children/c1",
    );
  });

  it("flags allergies, since that is safety information", () => {
    renderCard(makeChild({ allergies: "Arachides" }));

    expect(screen.getByText(/allergies/i)).toBeInTheDocument();
  });

  it("does not flag allergies when the field is blank or whitespace", () => {
    renderCard(makeChild({ allergies: "   " }));

    expect(screen.queryByText(/allergies/i)).not.toBeInTheDocument();
  });

  it("marks an archived child", () => {
    renderCard(makeChild({ status: "ARCHIVED" }));

    expect(screen.getByText("Archivé")).toBeInTheDocument();
  });

  it("falls back to initials when there is no photo", () => {
    const { container } = renderCard(makeChild());

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("MB")).toBeInTheDocument();
  });

  it("renders the photo when one exists", () => {
    renderCard(makeChild({ photo_url: "https://example.test/p.jpg" }));

    const image = screen.getByRole("presentation", { hidden: true });
    expect(image).toHaveAttribute("src", "https://example.test/p.jpg");
  });
});
