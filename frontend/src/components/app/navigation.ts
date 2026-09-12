import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  MessageSquareWarning,
  Palette,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  /** Translation key under `app.` */
  key: string;
  icon: LucideIcon;
  /** Only match this entry when the path is exactly `to`. */
  end?: boolean;
}

export interface NavSection {
  /** Translation key under `app.section.`, or none for an unlabelled group. */
  key?: string;
  items: readonly NavItem[];
}

/**
 * The two sidebars.
 *
 * Grouped rather than flat: staff has eight destinations, and eight
 * undifferentiated rows is a list to read every time rather than a shape
 * to recognise. Exported so a test can assert every entry has a route —
 * "La crèche" once sat in the public nav pointing at a 404 for several
 * phases, and nothing noticed.
 */
export const NAVIGATION: Record<"parent" | "staff", readonly NavSection[]> = {
  parent: [
    {
      items: [
        { to: "/parent", key: "home", icon: LayoutDashboard, end: true },
        { to: "/parent/timeline", key: "timeline", icon: CalendarDays },
        { to: "/parent/activities", key: "activities", icon: Palette },
      ],
    },
    {
      key: "people",
      items: [
        { to: "/parent/messages", key: "messages", icon: MessageCircle },
        { to: "/parent/complaints", key: "complaints", icon: MessageSquareWarning },
        { to: "/parent/profile", key: "profile", icon: UserRound },
      ],
    },
  ],
  staff: [
    {
      key: "overview",
      items: [{ to: "/staff", key: "dashboard", icon: LayoutDashboard, end: true }],
    },
    {
      key: "daily",
      items: [
        { to: "/staff/children", key: "children", icon: Users },
        { to: "/staff/activities", key: "activities", icon: Palette },
      ],
    },
    {
      key: "people",
      items: [
        { to: "/staff/messages", key: "messages", icon: MessageCircle },
        { to: "/staff/complaints", key: "complaints", icon: MessageSquareWarning },
        { to: "/staff/parents", key: "parents", icon: UserRound },
      ],
    },
    {
      key: "admin",
      items: [
        { to: "/staff/notifications", key: "notifications", icon: Bell },
        { to: "/staff/settings", key: "settings", icon: Settings },
      ],
    },
  ],
};

/** Flat list of every destination, for route-coverage assertions. */
export function allNavItems(area: "parent" | "staff"): NavItem[] {
  return NAVIGATION[area].flatMap((section) => [...section.items]);
}
