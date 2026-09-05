import type { ReactElement } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import { routeTable } from "@/app/routes";

/**
 * Mount the application's real route tree against an in-memory history.
 *
 * The table is imported, not re-declared: a route missing from the app is
 * therefore missing from the test as well.
 */
export function renderRouteAt(initialPath: string): ReactElement {
  const router = createMemoryRouter(routeTable, {
    initialEntries: [initialPath],
  });
  return <RouterProvider router={router} />;
}
