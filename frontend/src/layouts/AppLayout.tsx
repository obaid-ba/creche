import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { Button, Logo } from "@/components/ui";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/cn";

/** Exported so a test can assert every entry has a matching route. */
export const NAV: Record<
  "parent" | "staff",
  readonly { to: string; label: string }[]
> = {
  parent: [
    { to: "/parent", label: "Accueil" },
    { to: "/parent/timeline", label: "Journée" },
    { to: "/parent/activities", label: "Activités" },
    { to: "/parent/messages", label: "Messages" },
    { to: "/parent/complaints", label: "Réclamations" },
    { to: "/parent/profile", label: "Profil" },
  ],
  staff: [
    { to: "/staff", label: "Tableau de bord" },
    { to: "/staff/children", label: "Enfants" },
    { to: "/staff/activities", label: "Activités" },
    { to: "/staff/messages", label: "Messages" },
    { to: "/staff/complaints", label: "Réclamations" },
    { to: "/staff/parents", label: "Parents" },
    { to: "/staff/settings", label: "Paramètres" },
  ],
};

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
          <Logo size="sm" to={area === "parent" ? "/parent" : "/staff"} />

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
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

      <nav
        aria-label="Navigation"
        className="border-b border-ink-100 bg-white"
      >
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {NAV[area].map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/parent" || item.to === "/staff"}
                className={({ isActive }) =>
                  cn(
                    "inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                    isActive
                      ? "border-primary-500 text-primary-700"
                      : "border-transparent text-ink-500 hover:text-ink-800",
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
