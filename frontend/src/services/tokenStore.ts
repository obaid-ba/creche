/**
 * In-memory access token store.
 *
 * The token is deliberately held in a module-scoped variable and NEVER in
 * localStorage or sessionStorage: this application holds children's
 * records, and web storage is readable by any script that achieves XSS.
 * The refresh token lives in an httpOnly cookie the browser attaches on
 * its own, so a page reload recovers the session without ever exposing a
 * long-lived credential to JavaScript (docs/authentication.md 2).
 */
let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
