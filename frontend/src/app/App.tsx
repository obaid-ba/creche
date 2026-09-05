import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/features/auth/AuthContext";

import { queryClient } from "./queryClient";
import { router } from "./routes";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
