import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/i18n/config";

import { Alert } from "../Alert";

/**
 * Two kinds of message reach an Alert and they must not be confused.
 *
 * The client produces a few of its own — a network failure has no
 * response to carry one — and those are translation keys, because the
 * axios client has no React context to translate in. Everything else is
 * an API message, already a sentence in the request's language, which
 * must survive untouched even though it contains dots and colons that
 * look like key syntax.
 */
afterEach(async () => {
  await i18n.changeLanguage("fr");
});

describe("Alert", () => {
  it("translates a key", () => {
    render(<Alert tone="danger">network.offline</Alert>);
    expect(
      screen.getByText(/Impossible de contacter le serveur/),
    ).toBeInTheDocument();
  });

  it("translates the same key into Arabic", async () => {
    await i18n.changeLanguage("ar");
    render(<Alert tone="danger">network.offline</Alert>);
    expect(screen.getByText(/تعذّر الاتصال بالخادم/)).toBeInTheDocument();
  });

  it("passes a server sentence through unchanged", () => {
    const message = "Format attendu : MAM-XXXXX. Réessayez.";
    render(<Alert tone="danger">{message}</Alert>);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("leaves element children alone", () => {
    render(
      <Alert>
        <strong>network.offline</strong>
      </Alert>,
    );
    // Not a plain string, so it is markup the caller composed, not a key.
    expect(screen.getByText("network.offline")).toBeInTheDocument();
  });

  it("announces a danger immediately and a softer tone politely", () => {
    const { rerender } = render(<Alert tone="danger">x</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<Alert tone="info">x</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
