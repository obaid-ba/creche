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
    { field: string; labelKey: string; values: readonly string[]; group: string }
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
};

/**
 * One-tap event recording for staff.
 *
 * Types needing no payload are recorded immediately; the rest open a
 * small dialog for the single value they require. Recording a nap is one
 * tap now and one tap later ("Terminer"), which is the two-interaction
 * workflow the brief implies while still storing a single row
 * (docs/timeline.md 4.2).
 */
export function QuickAddBar({
  specs,
  onAdd,
  isPending,
}: {
  specs: EventTypeSpec[];
  onAdd: (input: CreateEventInput) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<EventTypeSpec | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const quickTypes = specs.filter((spec) => spec.quick_add);

  function record(spec: EventTypeSpec, data: Record<string, unknown> = {}) {
    onAdd({
      type: spec.key,
      occurred_at: new Date().toISOString(),
      data,
    });
  }

  function handleClick(spec: EventTypeSpec) {
    if (PROMPTS[spec.key] !== undefined || CHOICES[spec.key] !== undefined) {
      setValue("");
      setError(null);
      setActive(spec);
      return;
    }
    record(spec);
  }

  function submitDialog() {
    if (active === null) return;

    const prompt = PROMPTS[active.key];
    const choice = CHOICES[active.key];

    if (prompt !== undefined) {
      const numeric = Number(value);
      if (value.trim() === "" || Number.isNaN(numeric)) {
        setError(t("timeline.invalidValue"));
        return;
      }
      record(active, { [prompt.field]: numeric });
    } else if (choice !== undefined) {
      if (value === "") {
        setError(t("timeline.chooseSomething"));
        return;
      }
      record(active, { [choice.field]: value });
    }

    setActive(null);
  }

  const prompt = active !== null ? PROMPTS[active.key] : undefined;
  const choice = active !== null ? CHOICES[active.key] : undefined;

  return (
    <>
      <div
        role="group"
        aria-label={t("timeline.recordEvent")}
        className="flex flex-wrap gap-2"
      >
        {quickTypes.map((spec) => (
          <button
            key={spec.key}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(spec)}
            className={cn(
              "flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold",
              "ring-1 ring-ink-200 transition-colors hover:bg-ink-50",
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
            {spec.label}
          </button>
        ))}
      </div>

      <Modal
        isOpen={active !== null}
        onClose={() => setActive(null)}
        title={active?.label ?? ""}
        description={t("timeline.recordedNow")}
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
              label: t(`event.${choice.group}.${optionValue}`),
            }))}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Modal>
    </>
  );
}
