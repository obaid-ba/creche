import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AgeGroupSection } from "../components/AgeGroupSection";
import type { ChildListItem } from "../types";

function makeChild(id: string, firstName: string): ChildListItem {
  return {
    id,
    first_name: firstName,
    last_name: "Test",
    full_name: `${firstName} Test`,
    date_of_birth: "2024-03-15",
    age_months: 12,
    age_display: "1 an",
    age_group: { key: "TODDLER", label: "1 → 2 ans" },
    gender: "M",
    photo_url: null,
    status: "ACTIVE",
    allergies: "",
  };
}

function renderSection(items: ChildListItem[]) {
  return render(
    <MemoryRouter>
      <AgeGroupSection label="1 → 2 ans" items={items} />
    </MemoryRouter>,
  );
}

describe("AgeGroupSection", () => {
  it("labels the section and counts its children", () => {
    renderSection([makeChild("1", "Mohamed"), makeChild("2", "Yasmine")]);

    expect(screen.getByRole("heading", { name: "1 → 2 ans" })).toBeInTheDocument();
    expect(screen.getByText("2 enfants")).toBeInTheDocument();
  });

  it("uses the singular for one child", () => {
    renderSection([makeChild("1", "Mohamed")]);

    expect(screen.getByText("1 enfant")).toBeInTheDocument();
  });

  it("renders an empty band rather than hiding it, so the order stays stable", () => {
    renderSection([]);

    expect(screen.getByRole("heading", { name: "1 → 2 ans" })).toBeInTheDocument();
    expect(screen.getByText(/aucun enfant dans ce groupe/i)).toBeInTheDocument();
    // "0 enfant", not "0 enfants": French puts zero in the singular, which
    // the hand-rolled `count === 1 ? "" : "s"` this replaced got wrong.
    // CLDR knows, so i18next does.
    expect(screen.getByText("0 enfant")).toBeInTheDocument();
  });

  it("associates the list with its heading for screen readers", () => {
    renderSection([makeChild("1", "Mohamed")]);

    const section = screen.getByRole("region", { name: "1 → 2 ans" });
    expect(within(section).getByText("Mohamed Test")).toBeInTheDocument();
  });
});
