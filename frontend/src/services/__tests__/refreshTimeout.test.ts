import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The boot refresh must carry its own timeout.
 *
 * It is made with bare `axios` rather than `apiClient`, because going
 * through the instance whose interceptor invoked it would recurse — and
 * that loses the instance's 20s timeout. Axios defaults to 0, meaning no
 * timeout at all, so the request that gates every page load could hang
 * forever against a sleeping server.
 *
 * Asserted against the source because the alternative is a test that
 * waits 75 seconds.
 */
describe("the refresh call", () => {
  const source = readFileSync(
    join(__dirname, "..", "client.ts"),
    "utf8",
  );

  it("passes an explicit timeout, since bare axios has none", () => {
    const call = source.slice(
      source.indexOf("async function refreshAccessToken"),
      source.indexOf("let onSessionExpired"),
    );
    expect(call, "refreshAccessToken must set a timeout").toMatch(
      /timeout:\s*REFRESH_TIMEOUT_MS/,
    );
  });

  it("allows longer than the API default, so a cold start is not a logout", () => {
    const configured = /REFRESH_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(source)?.[1];
    expect(configured, "REFRESH_TIMEOUT_MS must be defined").toBeDefined();
    const ms = Number(configured?.replace(/_/g, ""));
    // A free-tier host takes ~50s to wake; failing earlier would bounce a
    // signed-in parent to the login page for no reason.
    expect(ms).toBeGreaterThan(50_000);
    // But it must still be bounded.
    expect(ms).toBeLessThan(180_000);
  });
});
