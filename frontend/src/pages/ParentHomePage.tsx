import {
  CalendarClock,
  MessageCircle,
  MessageSquareWarning,
  Palette,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageShell } from "@/components/app";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  ErrorState,
  LinkButton,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { ChildAvatar } from "@/features/children/components/ChildAvatar";
import { DailySummaryCards } from "@/features/daily-records/components/DailySummaryCards";
import { useParentDashboard } from "@/features/dashboard/hooks";
import { eventEmoji, formatTime } from "@/features/timeline/eventDisplay";

function CountTile({
  icon: Icon,
  label,
  count,
  to,
}: {
  icon: typeof MessageCircle;
  label: string;
  count: number;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-card border border-ink-100 bg-white p-4 shadow-soft transition-colors hover:border-primary-200"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-card bg-primary-100 text-primary-700">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold text-ink-900">{count}</span>
        <span className="block truncate text-xs text-ink-500">{label}</span>
      </span>
    </Link>
  );
}

export function ParentHomePage() {
  const { user } = useAuth();
  const query = useParentDashboard();

  if (query.isPending) return <LoadingState label="Chargement…" />;
  if (query.isError) {
    return (
      <PageShell size="form">
        <ErrorState
          description="Impossible de charger votre tableau de bord."
          onRetry={() => void query.refetch()}
        />
      </PageShell>
    );
  }

  const { children, unread_messages, open_complaints } = query.data;

  return (
    <PageShell size="form">
      <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">Bonjour {user?.first_name}</h1>
      <p className="mt-1 text-ink-500">Voici la journée de votre enfant.</p>

      {children.length === 0 ? (
        <div className="mt-8">
          <Alert tone="info">
            Aucun enfant n'est rattaché à votre compte. Contactez la crèche
            pour obtenir un code d'accès.
          </Alert>
        </div>
      ) : (
        children.map((child) => (
          <section key={child.id} className="mt-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <ChildAvatar
                firstName={child.first_name}
                lastName={child.last_name}
                photoUrl={child.photo_url}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">{child.first_name}</h2>
                <p className="text-sm text-ink-500">
                  {child.age_display} ·{" "}
                  <Badge tone="secondary">{child.age_group.label}</Badge>
                </p>
              </div>
              <LinkButton to="/parent/timeline" size="sm" variant="outline">
                <CalendarClock aria-hidden="true" className="size-4" />
                Voir la journée
              </LinkButton>
            </div>

            {child.day_published ? (
              <>
                <DailySummaryCards summary={child.summary} />

                {child.latest_events.length > 0 && (
                  <Card className="mt-4">
                    <CardBody>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-400">
                        Derniers moments
                      </h3>
                      <ul className="space-y-2">
                        {child.latest_events.map((event) => (
                          <li key={event.id} className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-ink-400">
                              {formatTime(event.occurred_at)}
                            </span>
                            <span aria-hidden="true">
                              {eventEmoji(event.type)}
                            </span>
                            <span className="truncate text-sm text-ink-700">
                              {event.description !== ""
                                ? event.description
                                : event.type}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>
                )}

                {child.general_notes.trim() !== "" && (
                  <Card className="mt-4">
                    <CardBody>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-400">
                        Mot de l'équipe
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-ink-700">
                        {child.general_notes}
                      </p>
                    </CardBody>
                  </Card>
                )}
              </>
            ) : (
              <Alert tone="info">
                L'équipe n'a pas encore publié la journée de{" "}
                {child.first_name}. Revenez un peu plus tard.
              </Alert>
            )}
          </section>
        ))
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <CountTile
          icon={MessageCircle}
          label="Messages non lus"
          count={unread_messages}
          to="/parent/messages"
        />
        <CountTile
          icon={MessageSquareWarning}
          label="Réclamations en cours"
          count={open_complaints}
          to="/parent/complaints"
        />
        {/* A link, not a tile: there is no activity count on this
            endpoint, and showing a hardcoded 0 would be a lie. */}
        <Link
          to="/parent/activities"
          className="flex items-center gap-3 rounded-card border border-ink-100 bg-white p-4 shadow-soft transition-colors hover:border-primary-200"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-card bg-primary-100 text-primary-700">
            <Palette aria-hidden="true" className="size-5" />
          </span>
          <span className="text-sm font-bold text-ink-800">
            Voir les activités
          </span>
        </Link>
      </div>
    </PageShell>
  );
}
