import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { useDirection } from "@/i18n/useDirection";

import { queryClient } from "./queryClient";
import { router } from "./routes";

/**
 * Mirrors the whole document from one place, and refetches when the
 * language changes.
 *
 * `<html dir>` has to be set above the router: every logical CSS
 * property in the app reads from it, and a route-level effect would
 * leave the first paint in the wrong direction.
 *
 * The refetch matters because the API answers in the request's
 * `Accept-Language`: age groups, relationships and event labels are all
 * rendered server-side. Without invalidating, switching to Arabic leaves
 * every cached response in French until its own staleness expires, so
 * half the screen changes language and half does not.
 */
function DocumentLanguage({ children }: { children: React.ReactNode }) {
  const { language } = useDirection();

  useEffect(() => {
    void queryClient.invalidateQueries();
  }, [language]);

  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DocumentLanguage>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </DocumentLanguage>
    </QueryClientProvider>
  );
}
