import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SiteNavbar } from "@/components/public/SiteNavbar";

/**
 * The switcher is the only way an Arabic-reading visitor gets to their
 * own language, so these cover the whole path: the control is reachable,
 * it actually changes the copy, and it flips the document direction that
 * every logical CSS property in the app depends on.
 */
function renderNavbar() {
  return render(
    <MemoryRouter>
      <SiteNavbar />
    </MemoryRouter>,
  );
}

describe("language switcher", () => {
  it("starts in French with the document left-to-right", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Accueil" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("switches the interface to Arabic and mirrors the document", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /العربية/ }));

    expect(await screen.findByRole("link", { name: "الرئيسية" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Accueil" })).not.toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("marks the active language as pressed", async () => {
    const user = userEvent.setup();
    renderNavbar();

    const french = screen.getByRole("button", { name: /Français/ });
    const arabic = screen.getByRole("button", { name: /العربية/ });
    expect(french).toHaveAttribute("aria-pressed", "true");
    expect(arabic).toHaveAttribute("aria-pressed", "false");

    await user.click(arabic);

    expect(arabic).toHaveAttribute("aria-pressed", "true");
    expect(french).toHaveAttribute("aria-pressed", "false");
  });

  it("is reachable without opening the mobile menu", () => {
    // A visitor who reads only Arabic cannot be expected to find a
    // control hidden behind a button labelled in French.
    renderNavbar();
    const group = screen.getByRole("group", { name: "Langue" });
    expect(group.className).not.toMatch(/\bhidden\b/);
  });
});
