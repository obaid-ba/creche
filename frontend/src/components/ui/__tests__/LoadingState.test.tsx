import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoadingState } from "../States";

describe("LoadingState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the ordinary label first", () => {
    render(<LoadingState label="Vérification…" slowLabel="Le serveur se réveille…" />);
    expect(screen.getByText("Vérification…")).toBeInTheDocument();
  });

  it("explains itself once the wait stops looking normal", () => {
    // A spinner turning for a minute with nothing said reads as broken.
    // This is the whole point: the wait becomes legible.
    render(<LoadingState label="Vérification…" slowLabel="Le serveur se réveille…" />);

    act(() => vi.advanceTimersByTime(6000));

    expect(screen.getByText("Le serveur se réveille…")).toBeInTheDocument();
    expect(screen.queryByText("Vérification…")).not.toBeInTheDocument();
  });

  it("stays quiet when no slow label is given", () => {
    render(<LoadingState label="Chargement…" />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });

  it("is announced to assistive technology", () => {
    render(<LoadingState label="Chargement…" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
