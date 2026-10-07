import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuickAddBar } from "../components/QuickAddBar";
import type { CreateEventInput, EventTypeSpec, TimelineEventType } from "../types";

/**
 * The registry the API serves, trimmed to the quick-add chips. Kept in
 * step with backend/apps/care/event_types.py: REQUIRES_A_VALUE lists the
 * types whose payload schema has a required field, which is what makes
 * posting on the bare tap a 400.
 */
const QUICK_ADD: { key: TimelineEventType; label: string; needsValue: boolean }[] = [
  { key: "MEAL", label: "Repas", needsValue: true },
  { key: "BOTTLE", label: "Biberon", needsValue: true },
  { key: "SLEEP", label: "Sommeil", needsValue: false },
  { key: "DIAPER", label: "Change", needsValue: true },
  { key: "TOILET", label: "Toilettes", needsValue: true },
  { key: "TEMPERATURE", label: "Température", needsValue: true },
  { key: "MOOD", label: "Humeur", needsValue: true },
];

function spec(key: TimelineEventType, label: string): EventTypeSpec {
  return {
    key,
    label,
    icon: "circle",
    group: "other" as EventTypeSpec["group"],
    interval: key === "SLEEP",
    staff_creatable: true,
    quick_add: true,
  };
}

function renderBar() {
  const onAdd = vi.fn<(input: CreateEventInput) => Promise<void>>(
    () => Promise.resolve(),
  );
  render(
    <QuickAddBar
      specs={QUICK_ADD.map((t) => spec(t.key, t.label))}
      onAdd={onAdd}
      isPending={false}
      date="2026-10-07"
    />,
  );
  return onAdd;
}

describe("recording a toilet visit", () => {
  it("asks for the result instead of posting an empty payload", async () => {
    const onAdd = renderBar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toilettes/i }));

    // The bug: the tap posted {} and the server rejected it, so nothing
    // was ever recorded and nothing explained why.
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers both outcomes, worded as the timeline words them", async () => {
    renderBar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toilettes/i }));
    const select = screen.getByRole("combobox");

    expect(
      within(select).getByRole("option", { name: "Réussi" }),
    ).toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Sans résultat" }),
    ).toBeInTheDocument();
  });

  it("sends success as a real boolean, not the string \"true\"", async () => {
    const onAdd = renderBar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toilettes/i }));
    await user.selectOptions(screen.getByRole("combobox"), "true");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const input = onAdd.mock.calls[0]?.[0];
    expect(input?.type).toBe("TOILET");
    // ToiletPayload.success is a BooleanField; DRF would coerce "true",
    // but the contract is a boolean and the stored JSON should say so.
    expect(input?.data).toEqual({ success: true });
  });

  it("records the unsuccessful visit too", async () => {
    const onAdd = renderBar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /toilettes/i }));
    await user.selectOptions(screen.getByRole("combobox"), "false");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(onAdd.mock.calls[0]?.[0]?.data).toEqual({ success: false });
  });
});

describe("every quick-add chip that needs a value", () => {
  // The general form of the TOILET bug: a chip whose schema requires a
  // field but which posts on the bare tap can only ever produce a 400.
  for (const { key, label, needsValue } of QUICK_ADD.filter((t) => t.needsValue)) {
    it(`${key} opens a dialog rather than posting straight away`, async () => {
      const onAdd = renderBar();
      await userEvent.setup().click(screen.getByRole("button", { name: label }));

      expect(needsValue).toBe(true);
      expect(onAdd, `${key} posts an empty payload`).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  }
});

/**
 * The general form of the bug, checked against the backend itself.
 *
 * `TOILET` shipped as a quick-add chip whose payload schema requires
 * `success`, with no entry in QuickAddBar: tapping it posted `{}` and got
 * a 400 every time, so a toilet visit simply could not be recorded. The
 * list above pins today's types, but a type added to the registry
 * tomorrow would reintroduce the hole silently. This reads the registry
 * instead, the way apiSurface.test.ts reads the URL conf.
 *
 * Text comparison, like that test: coarse, but it catches the one failure
 * that actually happened.
 */
describe("the quick-add registry and the bar agree", () => {
  const EVENT_TYPES = join(
    __dirname, "..", "..", "..", "..", "..",
    "backend", "apps", "care", "event_types.py",
  );
  const BAR = join(__dirname, "..", "components", "QuickAddBar.tsx");

  it("gives every chip whose payload has a required field somewhere to enter it", () => {
    const python = readFileSync(EVENT_TYPES, "utf8");

    // Which payload class each quick-add type uses.
    const quickAdd = new Map<string, string>();
    for (const entry of python.split("EventTypeSpec(").slice(1)) {
      const key = /TimelineEventType\.(\w+)/.exec(entry)?.[1];
      const schema = /schema=(\w+)/.exec(entry)?.[1];
      if (key !== undefined && schema !== undefined && /quick_add=True/.test(entry)) {
        quickAdd.set(key, schema);
      }
    }
    expect(quickAdd.size, "found no quick-add types — did the registry move?")
      .toBeGreaterThan(0);

    // A field is required unless it says otherwise.
    function hasRequiredField(schema: string): boolean {
      const body = python.split(`class ${schema}(`)[1]?.split("\nclass ")[0] ?? "";
      return body
        .split(/\n(?=    \w)/)
        .some((line) => /serializers\.\w+Field\(/.test(line) && !/required=False/.test(line));
    }

    const bar = readFileSync(BAR, "utf8");
    const entered = new Set([
      ...[...bar.matchAll(/^ {2}([A-Z_]+): \{/gm)].map((m) => m[1]),
      "SLEEP", // its dialog is written out longhand, not table-driven
    ]);

    const unreachable = [...quickAdd]
      .filter(([key, schema]) => hasRequiredField(schema) && !entered.has(key))
      .map(([key, schema]) => `${key} (${schema}) has no QuickAddBar entry`);

    expect(unreachable).toEqual([]);
  });
});
