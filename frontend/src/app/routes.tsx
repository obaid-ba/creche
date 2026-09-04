import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";

import { LoadingState } from "@/components/ui";
import { PublicLayout } from "@/layouts/PublicLayout";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Route-level code splitting: a parent on a phone should not download the
// staff dashboard to read their child's day.
const HomePage = lazy(() =>
  import("@/pages/HomePage").then((m) => ({ default: m.HomePage })),
);

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<LoadingState />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: withSuspense(<HomePage />) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
