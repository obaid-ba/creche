import { MessageCircleOff, Search, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Pagination,
} from "@/components/ui";
import { useParents, useSetParentMessaging } from "@/features/parents/hooks";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const RELATIONSHIP_LABELS: Record<string, string> = {
  MOTHER: "Mère",
  FATHER: "Père",
  GUARDIAN: "Tuteur",
  OTHER: "Autre",
};

export function StaffParentsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchInput);
  const query = useParents({
    search,
    page,
    ...(onlyUnlinked ? { unlinked: "true" } : {}),
  });
  const setMessaging = useSetParentMessaging();

  const rows = query.data?.results ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Parents</h1>
      <p className="mt-1 text-sm text-ink-500">
        {query.data?.count ?? 0} parent{(query.data?.count ?? 0) === 1 ? "" : "s"}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input
            label="Rechercher"
            type="search"
            placeholder="Nom du parent ou de l'enfant…"
            value={searchInput}
            onChange={(event) => {
              setPage(1);
              setSearchInput(event.target.value);
            }}
            leftIcon={<Search className="size-4" />}
          />
        </div>

        <label className="flex h-11 items-center gap-2 rounded-card border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={onlyUnlinked}
            onChange={(event) => {
              setPage(1);
              setOnlyUnlinked(event.target.checked);
            }}
            className="size-4 rounded"
          />
          Sans enfant rattaché
        </label>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <LoadingState label="Chargement des parents…" />
        ) : query.isError ? (
          <ErrorState
            description="Impossible de charger la liste des parents."
            onRetry={() => void query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="Aucun parent"
            description={
              search !== "" || onlyUnlinked
                ? "Essayez de modifier votre recherche."
                : "Les parents apparaissent ici après avoir activé leur compte."
            }
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((parent) => (
              <li key={parent.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-start gap-4">
                    <div className="min-w-48 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-ink-900">
                          {parent.first_name} {parent.last_name}
                        </p>
                        {!parent.is_active && (
                          <Badge tone="neutral">Compte désactivé</Badge>
                        )}
                        {!parent.can_send_messages && (
                          <Badge tone="warning">Messagerie coupée</Badge>
                        )}
                      </div>

                      <p className="mt-0.5 text-sm text-ink-500">
                        {parent.email}
                        {parent.phone !== "" && ` · ${parent.phone}`}
                      </p>

                      {parent.children.length === 0 ? (
                        <p className="mt-2 text-sm text-ink-400">
                          Aucun enfant rattaché
                        </p>
                      ) : (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {parent.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                to={`/staff/children/${child.id}`}
                                className="inline-flex items-center gap-1.5 rounded-pill bg-secondary-100 px-2.5 py-1 text-xs font-semibold text-secondary-800 hover:bg-secondary-200"
                              >
                                {child.first_name}
                                {/* A tint here (opacity-75) fell below the
                                    4.5:1 AA threshold; secondary-700 on
                                    secondary-100 clears it. */}
                                <span className="font-normal text-secondary-700">
                                  {RELATIONSHIP_LABELS[child.relationship] ??
                                    child.relationship}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={
                        setMessaging.isPending &&
                        setMessaging.variables?.id === parent.id
                      }
                      onClick={() =>
                        setMessaging.mutate({
                          id: parent.id,
                          canSend: !parent.can_send_messages,
                        })
                      }
                      leftIcon={<MessageCircleOff className="size-4" />}
                    >
                      {parent.can_send_messages
                        ? "Couper la messagerie"
                        : "Réactiver la messagerie"}
                    </Button>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {query.data !== undefined && (
        <div className="mt-6">
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
