import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Input, Modal, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

import { eventEmoji, groupAccent } from "../eventDisplay";
import type { CreateEventInput, EventTypeSpec, TimelineEventType } from "../types";

/** Extra field a type needs before it can be recorded in one tap.
 *
 *  The option values are the API's stored enums; only the labels are
 *  translated, and they share their keys with the timeline feed so a
 *  mood chosen here reads identically once it appears in the day. */
const PROMPTS: Partial<
  Record<TimelineEventType, { labelKey: string; field: string; type: string }>
> = {
  BOTTLE: { labelKey: "timeline.volumeMl", field: "volume_ml", type: "number" },
  TEMPERATURE: {
    labelKey: "timeline.temperatureC",
    field: "celsius",
    type: "number",
  },
};

const CHOICES: Partial<
  Record<
    TimelineEventType,
    {
      field: string;
      labelKey: string;
      values: readonly string[];
      group: string;
      /** For a type whose option labels are not `event.<group>.<VALUE>`. */
      optionKeys?: Readonly<Record<string, string>>;
      /** The stored payload is not always a string: see TOILET. */
      cast?: (raw: string) => unknown;
    }
  >
> = {
  MEAL: {
    field: "meal",
    labelKey: "timeline.meal",
    group: "meal",
    values: ["BREAKFAST", "LUNCH", "SNACK", "DINNER"],
  },
  MOOD: {
    field: "mood",
    labelKey: "timeline.mood",
    group: "mood",
    values: ["HAPPY", "CALM", "TIRED", "SAD", "IRRITATED", "ACTIVE"],
  },
  DIAPER: {
    field: "state",
    labelKey: "timeline.diaperState",
    group: "diaper",
    values: ["WET", "SOILED", "BOTH", "DRY"],
  },
  // The one quick-add chip with no way to record it: ToiletPayload makes
  // `success` required, so tapping "Toilettes" posted an empty payload
  // and the server answered 400 every time. The timeline could already
  // *display* a toilet event -- emoji, "Réussi"/"Sans résultat" -- so
  // only the input was missing.
  //
  // `success` is a boolean, not an enum, so the option values are the two
  // booleans as strings and `cast` turns the chosen one back. The labels
  // reuse the feed's own keys rather than duplicating the words under
  // `event.toilet.*`, so the dialog and the timeline cannot drift apart.
  TOILET: {
    field: "success",
    labelKey: "timeline.toiletResult",
    group: "toilet",
    values: ["true", "false"],
    optionKeys: {
      true: "event.toiletSuccess",
      false: "event.toiletNoResult",
    },
    cast: (raw) => raw === "true",
  },
};

/**
 * One-tap event recording for staff.
 *
 * Types needing no payload are recorded immediately; the rest open a
 * small dialog for the value they require.
 *
 * Sleep is the exception, because a nap has two ends. Tapping it still
 * starts an open interval to be closed later with "Terminer" — the
 * two-interaction flow the brief implies (docs/timeline.md 4.2) — but a
 * nap that has already finished by the time anyone reaches a screen is
 * at least as common, and there was no way to record one. The dialog now
 * takes both times, and leaving the end blank keeps the old behaviour.
 *
 * `date` is the day being viewed. Times entered here resolve against it
 * rather than against today, so a nap logged on yesterday's page lands on
 * yesterday.
 */
export function QuickAddBar({
  specs,
  onAdd,
  isPending,
  date,
}: {
  specs: EventTypeSpec[];
  onAdd: (input: CreateEventInput) => void | Promise<unknown>;
  isPending: boolean;
  /** YYYY-MM-DD, the day the timeline is showing. */
  date: string;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<EventTypeSpec | null>(null);
  const [value, setValue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [quality, setQuality] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** "14:30" on the displayed day, as an instant. */
  function at(time: string): string {
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(
      year ?? 1970, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0,
    ).toISOString();
  }

  const quickTypes = specs.filter((spec) => spec.quick_add);

  function record(spec: EventTypeSpec, data: Record<string, unknown> = {}) {
    onAdd({
      type: spec.key,
      occurred_at: new Date().toISOString(),
      data,
    });
  }

  /**
   * Posts, and closes only once the server has accepted.
   *
   * Closing optimistically threw away whatever had been typed the moment
   * anything was rejected, and left the reason to a banner elsewhere on
   * the page carrying the generic envelope message rather than the
   * specific one.
   */
  async function submit(input: CreateEventInput) {
    try {
      await onAdd(input);
      setActive(null);
    } catch (caught) {
      const apiError = caught as {
        fieldErrors?: Record<string, string[]>;
        message?: string;
      };
      const field = Object.values(apiError.fieldErrors ?? {})[0]?.[0];
      setError(field ?? apiError.message ?? t("common.error"));
    }
  }

  function handleClick(spec: EventTypeSpec) {
    if (
      PROMPTS[spec.key] !== undefined ||
      CHOICES[spec.key] !== undefined ||
      spec.key === "SLEEP"
    ) {
      setValue("");
      setError(null);
      // Start defaults to now, which is right for "he has just gone
      // down" and a sensible anchor to edit for anything else.
      const now = new Date();
      setStart(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      );
      setEnd("");
      setQuality("");
      setActive(spec);
      return;
    }
    record(spec);
  }

  function submitDialog() {
    if (active === null) return;

    if (active.key === "SLEEP") {
      if (start === "") {
        setError(t("timeline.startRequired"));
        return;
      }
      if (end !== "" && end < start) {
        setError(t("timeline.endBeforeStart"));
        return;
      }
      // The server refuses a future event, and finding that out after a
      // round-trip — with the dialog already closed and the times gone —
      // is a poor way to learn it.
      const latest = end === "" ? start : end;
      if (new Date(at(latest)).getTime() > Date.now()) {
        setError(t("timeline.futureTime"));
        return;
      }
      void submit({
        type: active.key,
        occurred_at: at(start),
        // Blank end means the nap is still going: an open interval, to
        // be closed from the timeline later.
        ...(end === "" ? {} : { ended_at: at(end) }),
        ...(quality === "" ? {} : { data: { quality } }),
      });
      return;
    }

    const prompt = PROMPTS[active.key];
    const choice = CHOICES[active.key];

    // Both branches go through submit() rather than record(): it awaits
    // the server and closes only on success. Closing here unconditionally
    // meant a rejected value vanished along with the dialog.
    if (prompt !== undefined) {
      const numeric = Number(value);
      if (value.trim() === "" || Number.isNaN(numeric)) {
        setError(t("timeline.invalidValue"));
        return;
      }
      void submit({
        type: active.key,
        occurred_at: new Date().toISOString(),
        data: { [prompt.field]: numeric },
      });
    } else if (choice !== undefined) {
      if (value === "") {
        setError(t("timeline.chooseSomething"));
        return;
      }
      void submit({
        type: active.key,
        occurred_at: new Date().toISOString(),
        data: {
          [choice.field]: choice.cast === undefined ? value : choice.cast(value),
        },
      });
    }
  }

  const prompt = active !== null ? PROMPTS[active.key] : undefined;
  const choice = active !== null ? CHOICES[active.key] : undefined;

  return (
    <>
      {/* A grid, not a wrapping row: seven chips of different word
          lengths left the second line ragged and half empty. Equal
          columns also give each one a bigger tap target, which is the
          point of a bar staff use one-handed while holding a child. */}
      <div
        role="group"
        aria-label={t("timeline.recordEvent")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {quickTypes.map((spec) => (
          <button
            key={spec.key}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(spec)}
            className={cn(
              "flex items-center gap-2 rounded-card px-3 py-2.5 text-sm font-semibold",
              "bg-shell ring-1 ring-ink-200 transition-all",
              "hover:bg-primary-50/60 hover:ring-primary-200",
              "disabled:cursor-not-allowed disabled:opacity-55",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 place-items-center rounded-full text-sm",
                groupAccent(spec.group),
              )}
            >
              {eventEmoji(spec.key)}
            </span>
            <span className="truncate">{spec.label}</span>
          </button>
        ))}
      </div>

      <Modal
        isOpen={active !== null}
        onClose={() => setActive(null)}
        title={active?.label ?? ""}
        description={t(
          active?.key === "SLEEP" ? "timeline.onDate" : "timeline.recordedNow",
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setActive(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submitDialog} isLoading={isPending}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        {active?.key === "SLEEP" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t("timeline.sleepStart")}
                type="time"
                autoFocus
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
              <Input
                label={t("timeline.sleepEnd")}
                type="time"
                value={end}
                hint={t("timeline.sleepEndHint")}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>

            <Select
              label={t("timeline.sleepQuality")}
              value={quality}
              placeholder={t("timeline.choose")}
              options={["GOOD", "RESTLESS", "POOR"].map((key) => ({
                value: key,
                label: t(`timeline.quality${key}`),
              }))}
              onChange={(event) => setQuality(event.target.value)}
            />

            {error !== null && (
              <p role="alert" className="text-sm font-semibold text-danger-700">
                {error}
              </p>
            )}
          </div>
        )}

        {prompt !== undefined && (
          <Input
            label={t(prompt.labelKey)}
            type={prompt.type}
            inputMode="decimal"
            autoFocus
            value={value}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        {choice !== undefined && (
          <Select
            label={t(choice.labelKey)}
            value={value}
            placeholder={t("timeline.choose")}
            options={choice.values.map((optionValue) => ({
              value: optionValue,
              label: t(
                choice.optionKeys?.[optionValue] ??
                  `event.${choice.group}.${optionValue}`,
              ),
            }))}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Modal>
    </>
  );
}
