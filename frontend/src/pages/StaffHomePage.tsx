import {
  CalendarCheck,
  MessageCircle,
  MessageSquareWarning,
  Palette,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { useStaffDashboard } from "@/features/dashboard/hooks";

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  to,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  to: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-card border border-ink-100 bg-white p-4 shadow-soft transition-colors hover:border-primary-200"
    >
      <span className={`grid size-9 place-items-center rounded-card ${tone}`}>
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-bold text-ink-900">{value}</p>
      {detail !== undefined && (
        <p className="mt-0.5 text-xs text-ink-500">{detail}</p>
      )}
    </Link>
  );
}

export function StaffHomePage() {
  const { user } = useAuth();
  const query = useStaffDashboard();

  if (query.isPending) return <LoadingState label="Chargement…" />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <ErrorState
          description="Impossible de charger le tableau de bord."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const data = query.data;
  const recordedShare =
    data.total_children > 0
      ? `${data.children_with_events_today} / ${data.total_children} enfants`
      : "Aucun enfant";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="mt-1 text-sm text-ink-500">
        Bonjour {user?.first_name}, voici la situation du jour.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Enfants"
          value={data.total_children}
          detail="Inscrits et actifs"
          to="/staff/children"
          tone="bg-secondary-100 text-secondary-700"
        />
        <StatTile
          icon={CalendarCheck}
          label="Journées saisies"
          value={recordedShare}
          detail={`${data.days_published_today} publiée(s)`}
          to="/staff/children"
          tone="bg-success-50 text-success-700"
        />
        <StatTile
          icon={MessageSquareWarning}
          label="Réclamations"
          value={data.new_complaints}
          detail={`${data.in_progress_complaints} en cours`}
          to="/staff/complaints"
          tone="bg-warning-50 text-warning-700"
        />
        <StatTile
          icon={MessageCircle}
          label="Messages non lus"
          value={data.unread_messages}
          to="/staff/messages"
          tone="bg-info-50 text-info-700"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Groupes d'âge"
            description="Répartition calculée depuis les dates de naissance"
          />
          <CardBody>
            <ul className="space-y-3">
              {data.age_groups.map((group) => {
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
                      <span className="text-sm font-bold text-ink-900">
                        {group.count}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-2 overflow-hidden rounded-pill bg-ink-100"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-pill bg-primary-400"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Activités récentes"
            action={
              <Link
                to="/staff/activities"
                className="text-sm font-semibold text-primary-700 underline underline-offset-2"
              >
                Tout voir
              </Link>
            }
          />
          <CardBody>
            {data.recent_activities.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <Palette aria-hidden="true" className="size-4" />
                Aucune activité enregistrée.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.recent_activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-800">
                        {activity.title}
                      </p>
                      <p className="text-xs text-ink-400">
                        {new Date(activity.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ink-500">
                      {activity.participant_count} enfant
                      {activity.participant_count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
