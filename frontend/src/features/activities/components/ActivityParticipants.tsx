import { Check, Loader2, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input } from "@/components/ui";
import { useChildren } from "@/features/children/hooks";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { useAddParticipants, useRemoveParticipant } from "../hooks";
import type { ActivityParticipant } from "../types";

/**
 * Who took part in an activity.
 *
 * This is the step that made the whole feature work. Participation is
 * what projects an ACTIVITY row onto a child's timeline, and the parent
 * queryset is filtered by it — so until something could add a child, every
 * activity staff created had zero participants, zero timeline rows, and
 * was invisible to every family. The endpoint and both hooks had existed
 * since Phase 6 with no caller.
 *
 * Staff-only: parents read their own child's participation off the card.
 */
export function ActivityParticipants({
  activityId,
  participants,
}: {
  activityId: string;
  participants: ActivityParticipant[];
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const add = useAddParticipants(activityId);
  const remove = useRemoveParticipant(activityId);

  // Only the active roster can be added: an archived child's family is no
  // longer being kept informed, so projecting a new event onto their
  // timeline would be wrong.
  // Debounced: `search` is part of the query key, so typing a name
  // unthrottled is one request per keystroke.
  const roster = useChildren({
    status: "ACTIVE",
    page_size: 100,
    search: useDebouncedValue(search),
  });

  const already = useMemo(
    () => new Set(participants.map((p) => p.child_id)),
    [participants],
  );
  const addable = (roster.data?.results ?? []).filter(
    (child) => !already.has(child.id),
  );

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (picked.size === 0) return;
    // The failure is rendered from add.isError; mutate keeps a rejection
    // from escaping as an unhandled promise.
    add.mutate([...picked], {
      onSuccess: () => {
        setPicked(new Set());
        setSearch("");
      },
    });
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-bold text-ink-900">
          {t("activities.participantsTitle")}
        </h3>

        {participants.length === 0 ? (
          // Not decoration: an activity with nobody in it reaches no
          // parent at all, and that is worth saying plainly.
          <Alert tone="info" className="mt-2">
            {t("activities.noParticipantsWarning")}
          </Alert>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {participants.map((participant) => (
              <li
                key={participant.child_id}
                className="flex items-center gap-1.5 rounded-full bg-ink-50 py-1 ps-3 pe-1.5 text-sm"
              >
                <span className="font-semibold text-ink-800">
                  {participant.first_name} {participant.last_name}
                </span>
                <button
                  type="button"
                  aria-label={t("activities.removeParticipant", {
                    name: `${participant.first_name} ${participant.last_name}`,
                  })}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(participant.child_id)}
                  className="grid size-6 place-items-center rounded-full text-ink-500 transition-colors hover:bg-danger-100 hover:text-danger-700 disabled:opacity-50"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-ink-100 pt-4">
        <h3 className="text-sm font-bold text-ink-900">
          {t("activities.addParticipants")}
        </h3>

        <Input
          label={t("children.search")}
          value={search}
          placeholder={t("activities.searchChild")}
          onChange={(event) => setSearch(event.target.value)}
        />

        {roster.isPending ? (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("children.loading")}
          </p>
        ) : roster.isError ? (
          <Alert tone="danger">{t("children.loadError")}</Alert>
        ) : addable.length === 0 ? (
          <p className="text-sm text-ink-500">{t("activities.everyoneAdded")}</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {addable.map((child) => {
              const isPicked = picked.has(child.id);
              return (
                <li key={child.id}>
                  {/* aria-pressed rather than a checkbox: the row is the
                      target, and a screen reader should hear the state
                      without a separate label to associate. */}
                  <button
                    type="button"
                    aria-pressed={isPicked}
                    onClick={() => toggle(child.id)}
                    className={`flex w-full items-center gap-2 rounded-card px-3 py-2 text-start text-sm transition-colors ${
                      isPicked
                        ? "bg-primary-50 font-semibold text-primary-800"
                        : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-4 shrink-0 place-items-center rounded border ${
                        isPicked
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-ink-300"
                      }`}
                    >
                      {isPicked && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{child.full_name}</span>
                    <span className="ms-auto shrink-0 text-xs text-ink-400">
                      {child.age_display}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {add.isError && <Alert tone="danger">{t("activities.addFailed")}</Alert>}
        {remove.isError && (
          <Alert tone="danger">{t("activities.removeFailed")}</Alert>
        )}

        <Button
          leftIcon={<UserPlus className="size-4" />}
          disabled={picked.size === 0}
          isLoading={add.isPending}
          onClick={submit}
        >
          {/* French CLDR counts zero as singular, so the plural form
              would render "Ajouter 0 enfant" on an empty selection. */}
          {picked.size === 0
            ? t("activities.addSelectedNone")
            : t("activities.addSelected", { count: picked.size })}
        </Button>
      </section>
    </div>
  );
}
