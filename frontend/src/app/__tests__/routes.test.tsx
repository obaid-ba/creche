import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthProvider } from "@/features/auth/AuthContext";
import { routeTable } from "@/app/routes";
import { allNavItems } from "@/components/app/navigation";
import { PublicLayout } from "@/layouts/PublicLayout";

/**
 * "La crèche" sat in the public navigation for several phases pointing at
 * /about, which had no route — so every visitor who clicked it landed on
 * the 404 page. These tests make that class of mistake fail the build.
 */

/** Public paths the brief requires, and that the router must serve. */
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/gallery",
  "/documents",
  "/contact",
  "/parent/login",
  "/staff/login",
];

function navTargets(): string[] {
  const { unmount } = render(
    <MemoryRouter>
      <PublicLayout />
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", { name: "Navigation principale" });
  const hrefs = Array.from(nav.querySelectorAll("a")).map(
    (a) => a.getAttribute("href") ?? "",
  );
  unmount();
  return hrefs;
}

describe("public navigation", () => {
  it("every nav link points at a route the router serves", () => {
    for (const href of navTargets()) {
      expect(PUBLIC_ROUTES, `nav links to ${href}, which has no route`).toContain(
        href,
      );
    }
  });

  it("offers every page the brief requires", () => {
    const hrefs = navTargets();
    for (const required of ["/", "/about", "/gallery", "/documents", "/contact"]) {
      expect(hrefs).toContain(required);
    }
  });
});

describe("router", () => {
  it.each(PUBLIC_ROUTES)(
    "%s renders a page rather than the 404",
    async (path) => {
      // The real route table, driven through a memory history — so a
      // missing entry falls through to the catch-all and fails here.
      const { renderRouteAt } = await import("./routeTestUtils");
      const element = renderRouteAt(path);

      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <AuthProvider>{element}</AuthProvider>
        </QueryClientProvider>,
      );

      await waitFor(
        () => {
          expect(
            screen.queryByRole("heading", { name: /page introuvable/i }),
            `${path} fell through to the 404 page`,
          ).not.toBeInTheDocument();
        },
        { timeout: 4000 },
      );
    },
  );
});

/**
 * The same guard for the authenticated areas. /parent/profile,
 * /staff/parents and /staff/settings were in the brief but unbuilt for
 * several phases; nav entries pointing at them would have 404'd.
 */
describe("application navigation", () => {
  function registeredPaths(area: "parent" | "staff"): string[] {
    const branch = routeTable.find((r) => r.path === `/${area}`);
    const layout = branch?.children?.[0];
    return (layout?.children ?? []).map((child) =>
      child.index === true ? `/${area}` : `/${area}/${child.path ?? ""}`,
    );
  }

  it.each(["parent", "staff"] as const)(
    "every %s nav link has a matching route",
    (area) => {
      const paths = registeredPaths(area);
      for (const item of allNavItems(area)) {
        expect(paths, `${item.to} is in the nav but has no route`).toContain(
          item.to,
        );
      }
    },
  );

  it("covers the parent routes the brief requires", () => {
    const paths = registeredPaths("parent");
    for (const required of [
      "/parent",
      "/parent/timeline",
      "/parent/activities",
      "/parent/complaints",
      "/parent/profile",
    ]) {
      expect(paths).toContain(required);
    }
  });

  it("covers the staff routes the brief requires", () => {
    const paths = registeredPaths("staff");
    for (const required of [
      "/staff",
      "/staff/children",
      "/staff/activities",
      "/staff/complaints",
      "/staff/parents",
      "/staff/settings",
    ]) {
      expect(paths).toContain(required);
    }
  });
});
