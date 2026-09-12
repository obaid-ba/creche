import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Initialise i18next explicitly rather than relying on some component in
// the import graph pulling it in: assertions here are written against
// French copy, and a test that silently rendered raw keys would still
// pass for any assertion that does not look at text.
import i18n from "@/i18n/config";

// jsdom does not implement scrollIntoView, though every real browser does.
// Stubbing it here keeps components that scroll (the message thread) free
// of defensive code for a problem that only exists in the test env.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

beforeEach(async () => {
  // The language detector reads localStorage, so a test that switched
  // language would otherwise leak into the next one.
  await i18n.changeLanguage("fr");
  document.documentElement.dir = "ltr";
});

afterEach(() => {
  cleanup();
});
