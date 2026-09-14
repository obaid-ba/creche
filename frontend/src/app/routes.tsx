import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";

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
const AboutPage = lazy(() =>
  import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);
const GalleryPage = lazy(() =>
  import("@/pages/GalleryPage").then((m) => ({ default: m.GalleryPage })),
);
const ContactPage = lazy(() =>
  import("@/pages/ContactPage").then((m) => ({ default: m.ContactPage })),
);
const DocumentsPage = lazy(() =>
  import("@/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
const ParentLoginPage = lazy(() =>
  import("@/pages/ParentLoginPage").then((m) => ({ default: m.ParentLoginPage })),
);
const StaffLoginPage = lazy(() =>
  import("@/pages/StaffLoginPage").then((m) => ({ default: m.StaffLoginPage })),
);
const ParentHomePage = lazy(() =>
  import("@/pages/ParentHomePage").then((m) => ({ default: m.ParentHomePage })),
);
const StaffHomePage = lazy(() =>
  import("@/pages/StaffHomePage").then((m) => ({ default: m.StaffHomePage })),
);
const StaffChildrenPage = lazy(() =>
  import("@/pages/staff/StaffChildrenPage").then((m) => ({
    default: m.StaffChildrenPage,
  })),
);
const StaffChildDetailPage = lazy(() =>
  import("@/pages/staff/StaffChildDetailPage").then((m) => ({
    default: m.StaffChildDetailPage,
  })),
);
const StaffChildCreatePage = lazy(() =>
  import("@/pages/staff/StaffChildCreatePage").then((m) => ({
    default: m.StaffChildCreatePage,
  })),
);
const StaffChildEditPage = lazy(() =>
  import("@/pages/staff/StaffChildEditPage").then((m) => ({
    default: m.StaffChildEditPage,
  })),
);
const StaffChildTimelinePage = lazy(() =>
  import("@/pages/staff/StaffChildTimelinePage").then((m) => ({
    default: m.StaffChildTimelinePage,
  })),
);
const ParentTimelinePage = lazy(() =>
  import("@/pages/parent/ParentTimelinePage").then((m) => ({
    default: m.ParentTimelinePage,
  })),
);
const ParentActivitiesPage = lazy(() =>
  import("@/pages/parent/ParentActivitiesPage").then((m) => ({
    default: m.ParentActivitiesPage,
  })),
);
const StaffActivitiesPage = lazy(() =>
  import("@/pages/staff/StaffActivitiesPage").then((m) => ({
    default: m.StaffActivitiesPage,
  })),
);
const ParentProfilePage = lazy(() =>
  import("@/pages/parent/ParentProfilePage").then((m) => ({
    default: m.ParentProfilePage,
  })),
);
const StaffParentsPage = lazy(() =>
  import("@/pages/staff/StaffParentsPage").then((m) => ({
    default: m.StaffParentsPage,
  })),
);
const StaffSettingsPage = lazy(() =>
  import("@/pages/staff/StaffSettingsPage").then((m) => ({
    default: m.StaffSettingsPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("@/pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const ComplaintsPage = lazy(() =>
  import("@/pages/ComplaintsPage").then((m) => ({ default: m.ComplaintsPage })),
);

function withSuspense(element: ReactNode) {
  // The fallback reserves a viewport of height. Without it the page
  // collapses to a spinner, the footer paints just below the header, and
  // then jumps when the route resolves — a 0.11 layout shift, above
  // Google's 0.1 "good" threshold, on every first load.
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <LoadingState />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

/**
 * The route tree, exported separately from the browser router so tests
 * can mount the same table against a memory history. Re-declaring routes
 * in tests would defeat the purpose: a route missing from the app has to
 * be missing from the test too.
 */
export const routeTable: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: withSuspense(<HomePage />) },
      { path: "/about", element: withSuspense(<AboutPage />) },
      { path: "/gallery", element: withSuspense(<GalleryPage />) },
      { path: "/contact", element: withSuspense(<ContactPage />) },
      { path: "/documents", element: withSuspense(<DocumentsPage />) },
    ],
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
        children: [
          { index: true, element: withSuspense(<ParentHomePage />) },
          { path: "timeline", element: withSuspense(<ParentTimelinePage />) },
          { path: "activities", element: withSuspense(<ParentActivitiesPage />) },
          { path: "complaints", element: withSuspense(<ComplaintsPage />) },
          { path: "profile", element: withSuspense(<ParentProfilePage />) },
          { path: "notifications", element: withSuspense(<NotificationsPage />) },
        ],
      },
    ],
  },

  {
    path: "/staff",
    element: <RequireRole allowed={["STAFF", "ADMIN"]} />,
    children: [
      {
        element: <AppLayout area="staff" />,
        children: [
          { index: true, element: withSuspense(<StaffHomePage />) },
          { path: "children", element: withSuspense(<StaffChildrenPage />) },
          // `new` is declared before `:childId` so it is not swallowed by
          // the dynamic segment.
          { path: "children/new", element: withSuspense(<StaffChildCreatePage />) },
          {
            path: "children/:childId",
            element: withSuspense(<StaffChildDetailPage />),
          },
          {
            path: "children/:childId/edit",
            element: withSuspense(<StaffChildEditPage />),
          },
          {
            path: "children/:childId/timeline",
            element: withSuspense(<StaffChildTimelinePage />),
          },
          { path: "activities", element: withSuspense(<StaffActivitiesPage />) },
          { path: "complaints", element: withSuspense(<ComplaintsPage />) },
          { path: "parents", element: withSuspense(<StaffParentsPage />) },
          { path: "notifications", element: withSuspense(<NotificationsPage />) },
          { path: "settings", element: withSuspense(<StaffSettingsPage />) },
        ],
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routeTable);
