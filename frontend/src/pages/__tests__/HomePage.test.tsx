import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PublicLayout } from "@/layouts/PublicLayout";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("public site", () => {
  it("renders the landing page inside the public layout", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", { level: 1, name: /second foyer/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("offers both parent-portal and registration calls to action", () => {
    renderAt("/");

    // The portal is reachable from the header and from the hero, so scope
    // the assertion instead of matching the name globally.
    const main = screen.getByRole("main");
    expect(
      within(main).getAllByRole("link", { name: /espace parents/i })[0],
    ).toHaveAttribute("href", "/parent/login");
    expect(
      within(main).getByRole("link", { name: /dossier d'inscription/i }),
    ).toHaveAttribute("href", "/documents");
  });

  it("puts a working parent-portal link in the header", () => {
    // This was a dead <Button onClick={() => undefined}> until running the
    // app surfaced it: the header CTA navigated nowhere.
    renderAt("/");

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: /espace parents/i }),
    ).toHaveAttribute("href", "/parent/login");
  });

  it("shows the values and services sections", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Nos valeurs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nos services" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bienveillance" })).toBeInTheDocument();
  });

  it("exposes a skip link before the navigation", () => {
    renderAt("/");

    expect(
      screen.getByRole("link", { name: /aller au contenu principal/i }),
    ).toHaveAttribute("href", "#contenu");
  });

  it("marks the current page in the navigation", () => {
    renderAt("/");

    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(
      within(nav).getByRole("link", { name: "Accueil" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("renders the French not-found page for an unknown route", () => {
    renderAt("/route-inexistante");

    expect(
      screen.getByRole("heading", { name: /page introuvable/i }),
    ).toBeInTheDocument();
  });
});
