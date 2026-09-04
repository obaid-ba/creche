import { LogOut } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

/** Shell shared by the parent and staff spaces. */
export function AppLayout({ area }: { area: "parent" | "staff" }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu principal
      </a>

      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={area === "parent" ? "/parent" : "/staff"} className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary-500 text-base">
              🧸
            </span>
            <span className="font-display font-bold text-ink-900">
              Crèche Mamati
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-600 sm:inline">
              {user?.first_name} {user?.last_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LogOut className="size-4" />}
              onClick={() => void logout()}
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
