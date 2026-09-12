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
      screen.getByRole("heading", { level: 1, name: /grandir.*sourire chaque jour/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("leads to the parent portal from the header and the page body", () => {
    renderAt("/");

    // The header CTA and the two in-page invitations all point at login.
    const portalLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/parent/login");

    expect(portalLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("offers the registration document", () => {
    renderAt("/");

    const main = screen.getByRole("main");
    const registration = within(main)
      .getAllByRole("link", { name: /dossier d'inscription/i })
      .map((a) => a.getAttribute("href"));

    // One routes to the page, one downloads the PDF directly.
    expect(
      registration.some((href) => href === "/documents" || href?.endsWith(".pdf")),
    ).toBe(true);
  });

  it("shows the sections the brief requires", () => {
    renderAt("/");
    const main = screen.getByRole("main");

    for (const heading of [
      /une journée chez mamati/i,
      /chaque petit moment/i,
      /nos activités/i,
      /galerie/i,
    ]) {
      expect(
        within(main).getByRole("heading", { name: heading }),
        `missing section: ${heading}`,
      ).toBeInTheDocument();
    }
  });

  it("names the four values", () => {
    renderAt("/");
    const values = screen.getByRole("region", { name: /nos valeurs/i });

    for (const value of ["Bienveillance", "Sécurité", "Éveil", "Transparence"]) {
      expect(within(values).getByText(value)).toBeInTheDocument();
    }
  });

  it("previews the day so the timeline feature is visible before login", () => {
    renderAt("/");
    const main = screen.getByRole("main");

    expect(within(main).getAllByText("08:15").length).toBeGreaterThan(0);
    expect(within(main).getAllByText(/petit déjeuner/i).length).toBeGreaterThan(0);
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
    expect(within(nav).getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the French not-found page for an unknown route", () => {
    renderAt("/route-inexistante");

    expect(
      screen.getByRole("heading", { name: /page introuvable/i }),
    ).toBeInTheDocument();
  });
});
