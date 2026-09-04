import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

import { LoadingState } from "@/components/ui";
import {
  RedirectIfAuthenticated,
  RequireRole,
} from "@/features/auth/guards";
import { AppLayout } from "@/layouts/AppLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Route-level code splitting: a parent on a phone should not download the
// staff dashboard to read their child's day.
const HomePage = lazy(() =>
  import("@/pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const ParentLoginPage = lazy(() =>
  import("@/pages/ParentLoginPage").then((m) => ({ default: m.ParentLoginPage })),
);
const StaffLoginPage = lazy(() =>
  import("@/pages/StaffLoginPage").then((m) => ({ default: m.StaffLoginPage })),
);
const ParentActivationPage = lazy(() =>
  import("@/pages/ParentActivationPage").then((m) => ({
    default: m.ParentActivationPage,
  })),
);
const ParentHomePage = lazy(() =>
  import("@/pages/ParentHomePage").then((m) => ({ default: m.ParentHomePage })),
);
const StaffHomePage = lazy(() =>
  import("@/pages/StaffHomePage").then((m) => ({ default: m.StaffHomePage })),
);

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LoadingState />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [{ path: "/", element: withSuspense(<HomePage />) }],
  },

  // Login pages sit outside the public shell — they have their own layout.
  {
    path: "/parent/login",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(<ParentLoginPage />)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/parent/activation",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(<ParentActivationPage />)}
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/staff/login",
    element: (
      <RedirectIfAuthenticated>
        {withSuspense(<StaffLoginPage />)}
      </RedirectIfAuthenticated>
    ),
  },

  {
    path: "/parent",
    element: <RequireRole allowed={["PARENT"]} />,
    children: [
      {
        element: <AppLayout area="parent" />,
        children: [{ index: true, element: withSuspense(<ParentHomePage />) }],
      },
    ],
  },

  {
    path: "/staff",
    element: <RequireRole allowed={["STAFF", "ADMIN"]} />,
    children: [
      {
        element: <AppLayout area="staff" />,
        children: [{ index: true, element: withSuspense(<StaffHomePage />) }],
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
]);
