import {
  ArrowRight,
  CalendarCheck,
  MessageCircle,
  MessageSquareWarning,
  Palette,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PageHeader, PageShell } from "@/components/app";
import { ErrorState, LoadingState } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { useStaffDashboard } from "@/features/dashboard/hooks";
import { useLocale } from "@/i18n/useLocale";

/**
 * The tile the dashboard is built from.
 *
 * The icon sits in a tinted field taken from the public site's palette,
 * so a member of staff who has seen the website recognises the same
 * brand rather than a separate admin theme.
 */
function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  to,
  field,
  ink,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  to: string;
  field: string;
  ink: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col overflow-hidden rounded-card bg-shell p-5 shadow-soft transition-shadow hover:shadow-lifted"
    >
      <span className="flex items-center justify-between">
        <span
          className={`grid size-11 place-items-center rounded-card ${field} ${ink}`}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <ArrowRight
          aria-hidden="true"
          className="size-4 text-ink-200 transition-all group-hover:translate-x-0.5 group-hover:text-ink-400 rtl:group-hover:-translate-x-0.5"
        />
      </span>

      <span className="mt-4 block text-xs font-bold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      {/* `tabular-nums` so the four tiles' figures line up on a common
          baseline grid instead of jittering as counts change. */}
      <span className="mt-1 block font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-secondary-900">
        {value}
      </span>
      <span className="mt-1.5 block min-h-4 text-xs text-ink-500">
        {detail ?? ""}
      </span>
    </Link>
  );
}

/** Each age group keeps its own tint, so the chart reads as four groups. */
const GROUP_TONES = [
  "bg-primary-400",
  "bg-sky-300",
  "bg-accent-300",
  "bg-mint-300",
] as const;

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card bg-shell shadow-soft">
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-secondary-900">
            {title}
          </h2>
          {description !== undefined && (
            <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          )}
        </div>
        {action !== undefined && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function StaffHomePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user } = useAuth();
  const query = useStaffDashboard();

  if (query.isPending) return <LoadingState label={t("common.loading")} />;
  if (query.isError) {
    return (
      <PageShell>
        <ErrorState
          description={t("dashboard.loadError")}
          onRetry={() => void query.refetch()}
        />
      </PageShell>
    );
  }

  const data = query.data;

  // A bare ratio, not "6 / 10 enfants": the other three tiles show a
  // single figure, and a sentence in the value slot made the row read as
  // four different kinds of thing. The noun belongs on the detail line.
  const hasChildren = data.total_children > 0;
  const recordedShare = hasChildren
    ? t("dashboard.recordedRatio", {
        done: data.children_with_events_today,
        total: data.total_children,
      })
    : t("dashboard.noChildrenShort");

  return (
    <PageShell>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.greeting", { name: user?.first_name ?? "" })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Users}
          label={t("dashboard.children")}
          value={data.total_children}
          detail={t("dashboard.childrenDetail")}
          to="/staff/children"
          field="bg-secondary-100"
          ink="text-secondary-700"
        />
        <StatTile
          icon={CalendarCheck}
          label={t("dashboard.daysRecorded")}
          value={recordedShare}
          detail={
            hasChildren
              ? t("dashboard.daysPublished", {
                  count: data.days_published_today,
                })
              : t("dashboard.noChildren")
          }
          to="/staff/children"
          field="bg-mint-100"
          ink="text-mint-700"
        />
        <StatTile
          icon={MessageSquareWarning}
          label={t("dashboard.complaints")}
          value={data.new_complaints}
          detail={t("dashboard.complaintsDetail", {
            count: data.in_progress_complaints,
          })}
          to="/staff/complaints"
          field="bg-accent-100"
          ink="text-accent-700"
        />
        <StatTile
          icon={MessageCircle}
          label={t("dashboard.unreadMessages")}
          value={data.unread_messages}
          to="/staff/messages"
          field="bg-sky-100"
          ink="text-sky-700"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel
          title={t("dashboard.ageGroups")}
          description={t("dashboard.ageGroupsDetail")}
        >
          <ul className="space-y-3.5">
            {data.age_groups.map((group, index) => {
              const share =
                data.total_children > 0
                  ? (group.count / data.total_children) * 100
                  : 0;
              return (
                <li key={group.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink-700">
                      {group.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-secondary-900">
                      {group.count}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-ink-100"
                    role="presentation"
                  >
                    <div
                      className={`h-full rounded-pill transition-[width] duration-500 ${
                        GROUP_TONES[index % GROUP_TONES.length] ?? ""
                      }`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title={t("dashboard.recentActivities")}
          action={
            <Link
              to="/staff/activities"
              className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50"
            >
              {t("dashboard.seeAll")}
            </Link>
          }
        >
          {data.recent_activities.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <Palette aria-hidden="true" className="size-4" />
              {t("dashboard.noActivities")}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.recent_activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-800">
                      {activity.title}
                    </p>
                    <p className="text-xs text-ink-400">
                      {new Date(activity.date).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-pill bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-500">
                    {t("common.child", { count: activity.participant_count })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
