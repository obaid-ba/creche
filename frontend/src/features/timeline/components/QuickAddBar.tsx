import { useState } from "react";

import { Button, Input, Modal, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

import { eventEmoji, groupAccent } from "../eventDisplay";
import type { CreateEventInput, EventTypeSpec, TimelineEventType } from "../types";

/** Extra field a type needs before it can be recorded in one tap. */
const PROMPTS: Partial<
  Record<TimelineEventType, { label: string; field: string; type: string }>
> = {
  BOTTLE: { label: "Volume (ml)", field: "volume_ml", type: "number" },
  TEMPERATURE: { label: "Température (°C)", field: "celsius", type: "number" },
};

const CHOICES: Partial<
  Record<TimelineEventType, { field: string; label: string; options: [string, string][] }>
> = {
  MEAL: {
    field: "meal",
    label: "Repas",
    options: [
      ["BREAKFAST", "Petit déjeuner"],
      ["LUNCH", "Déjeuner"],
      ["SNACK", "Goûter"],
      ["DINNER", "Dîner"],
    ],
  },
  MOOD: {
    field: "mood",
    label: "Humeur",
    options: [
      ["HAPPY", "Joyeux"],
      ["CALM", "Calme"],
      ["TIRED", "Fatigué"],
      ["SAD", "Triste"],
      ["IRRITATED", "Irrité"],
      ["ACTIVE", "Actif"],
    ],
  },
  DIAPER: {
    field: "state",
    label: "État",
    options: [
      ["WET", "Mouillé"],
      ["SOILED", "Sale"],
      ["BOTH", "Mouillé et sale"],
      ["DRY", "Sec"],
    ],
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
        setError("Veuillez saisir une valeur valide.");
        return;
      }
      record(active, { [prompt.field]: numeric });
    } else if (choice !== undefined) {
      if (value === "") {
        setError("Veuillez faire un choix.");
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
        aria-label="Enregistrer un événement"
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
        description="Enregistré à l'heure actuelle."
        footer={
          <>
            <Button variant="outline" onClick={() => setActive(null)}>
              Annuler
            </Button>
            <Button onClick={submitDialog} isLoading={isPending}>
              Enregistrer
            </Button>
          </>
        }
      >
        {prompt !== undefined && (
          <Input
            label={prompt.label}
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
            label={choice.label}
            value={value}
            placeholder="Choisir…"
            options={choice.options.map(([optionValue, optionLabel]) => ({
              value: optionValue,
              label: optionLabel,
            }))}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Modal>
    </>
  );
}
