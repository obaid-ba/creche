import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { LanguageSwitcher } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { cn } from "@/lib/cn";

import { NAVIGATION } from "./navigation";

/**
 * The application rail.
 *
 * A sidebar rather than the row of tabs this replaced: staff has eight
 * destinations, which at tablet width pushed the tab bar into a
 * horizontal scroller — a navigation you have to scroll to see is one
 * half the team never discovers. Vertically there is room for all of
 * them, grouped, with icons, at every width above `lg`.
 *
 * Every offset here is logical (`border-e`, `ms-`), so the rail moves to
 * the right-hand side under Arabic without a second stylesheet.
 */
export function AppSidebar({
  area,
  onNavigate,
  withBell = false,
}: {
  area: "parent" | "staff";
  onNavigate?: () => void;
  /** The rail carries the bell at lg and above; below that the top bar
   *  does, because the rail is behind a menu button and a notification
   *  you have to open a drawer to see is one you never see. */
  withBell?: boolean;
}) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const initials = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((part) => part?.[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col bg-shell">
      <div className="px-5 pb-4 pt-5">
        <NavLink to={area === "parent" ? "/parent" : "/staff"} onClick={onNavigate}>
          <Wordmark variant="compact" />
        </NavLink>

        {/* The bell shares the row below rather than the wordmark's:
            beside it, the two together overflow a 16rem rail and the
            name breaks across two lines. */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="inline-flex rounded-pill bg-secondary-50 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-secondary-700">
            {t(area === "staff" ? "shell.staffArea" : "shell.parentArea")}
          </p>
          {withBell && <NotificationBell />}
        </div>
      </div>

      <nav
        aria-label={t("app.label")}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
      >
        {NAVIGATION[area].map((section, index) => (
          <div key={section.key ?? index} className={index > 0 ? "mt-5" : ""}>
            {section.key !== undefined && (
              <p className="mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-wider text-ink-300">
                {t(`app.section.${section.key}`)}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end ?? false}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-card px-3 py-2.5 text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-primary-50 text-primary-700"
                          : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          aria-hidden="true"
                          className={cn(
                            "size-[1.15rem] shrink-0",
                            isActive ? "text-primary-600" : "text-ink-400",
                          )}
                        />
                        <span className="truncate">{t(`app.${item.key}`)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-3">
        <div className="flex items-center gap-2.5 rounded-card px-2 py-2">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary-100 font-display text-sm font-bold text-secondary-700"
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink-900">
              {user?.first_name} {user?.last_name}
            </span>
            <span className="block truncate text-xs text-ink-400">
              {user?.email}
            </span>
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-xs font-bold text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger-700"
          >
            <LogOut aria-hidden="true" className="size-3.5" />
            {t("shell.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
