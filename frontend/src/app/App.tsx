import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { useDirection } from "@/i18n/useDirection";

import { queryClient } from "./queryClient";
import { router } from "./routes";

/**
 * Mirrors the whole document from one place.
 *
 * `<html dir>` has to be set above the router: every logical CSS
 * property in the app reads from it, and a route-level effect would
 * leave the first paint in the wrong direction.
 */
function DocumentDirection({ children }: { children: React.ReactNode }) {
  useDirection();
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DocumentDirection>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </DocumentDirection>
    </QueryClientProvider>
  );
}
