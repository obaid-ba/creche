import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAccessToken,
  getAccessToken,
  onAccessTokenChange,
  setAccessToken,
} from "../tokenStore";

describe("tokenStore", () => {
  beforeEach(() => {
    clearAccessToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("holds and returns the token", () => {
    setAccessToken("abc");
    expect(getAccessToken()).toBe("abc");
  });

  it("clears the token", () => {
    setAccessToken("abc");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  /**
   * The security property this module exists for: an XSS that reads web
   * storage must find nothing. See docs/authentication.md 2.
   */
  it("never writes the token to localStorage or sessionStorage", () => {
    setAccessToken("super-secret-token");

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain("super-secret-token");
  });

  it("notifies subscribers on change", () => {
    const listener = vi.fn();
    const unsubscribe = onAccessTokenChange(listener);

    setAccessToken("abc");
    expect(listener).toHaveBeenCalledWith("abc");

    unsubscribe();
    setAccessToken("def");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
