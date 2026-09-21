import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every API path the client calls must exist on the server.
 *
 * Twice now a backend endpoint has been deleted and the frontend kept
 * calling it: the parent profile's "rattacher un autre enfant" form went
 * on POSTing to `/auth/parent/link-child/` for a week after that view was
 * removed, returning 404 on every click. TypeScript cannot see across
 * that boundary and no unit test noticed, because the call was mocked.
 *
 * This compares the two sides as text. It is coarse — it cannot check
 * methods or payloads — but it catches a whole route disappearing, which
 * is the failure that actually happened.
 */
const FRONTEND = join(__dirname, "..", "..");
const BACKEND = join(FRONTEND, "..", "..", "backend");

function walk(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "__pycache__") continue;
    if (statSync(full).isDirectory()) out.push(...walk(full, match));
    else if (match.test(entry)) out.push(full);
  }
  return out;
}

/** The literal paths the client asks apiClient for. */
function clientPaths(): { path: string; file: string }[] {
  const found: { path: string; file: string }[] = [];
  for (const file of walk(FRONTEND, /\.tsx?$/)) {
    if (file.includes("__tests__")) continue;
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(
      /apiClient\.\w+<[^>]*>?\(\s*[`"']([^`"']+)[`"']/g,
    )) {
      found.push({ path: m[1] ?? "", file });
    }
    for (const m of source.matchAll(/apiClient\.\w+\(\s*[`"']([^`"']+)[`"']/g)) {
      found.push({ path: m[1] ?? "", file });
    }
  }
  return found;
}

/** Route fragments Django registers, as raw text.
 *
 *  Every app module, not just `urls.py` and `views.py`: a DRF `@action`
 *  registers a route from wherever the viewset happens to live, and
 *  scanning only the obvious two files reported working endpoints as
 *  missing. */
function serverRouteText(): string {
  return walk(join(BACKEND, "apps"), /\.py$/)
    .filter((f) => !f.includes("/tests/") && !f.includes("/migrations/"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
}

describe("client API surface", () => {
  it("calls no path the server does not define", () => {
    const routes = serverRouteText();

    const orphans = clientPaths()
      // Drop the interpolated segments; what is left is the literal
      // scaffolding, which is what appears in a Django route.
      .map(({ path, file }) => ({
        file: file.replace(FRONTEND, "src"),
        path,
        segments: path
          .split("/")
          .filter((s) => s !== "" && !s.startsWith("$") && !s.startsWith("{")),
      }))
      .filter(({ segments }) => segments.length > 0)
      .filter(({ segments }) => !segments.every((s) => routes.includes(s)));

    expect(
      orphans.map((o) => `${o.path}  (${o.file})`),
      "these paths are called by the client but appear in no Django route",
    ).toEqual([]);
  });
});
