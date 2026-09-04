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

    expect(
      screen.getByRole("link", { name: /espace parents/i }),
    ).toHaveAttribute("href", "/parent/login");
    expect(
      screen.getByRole("link", { name: /dossier d'inscription/i }),
    ).toHaveAttribute("href", "/documents");
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
