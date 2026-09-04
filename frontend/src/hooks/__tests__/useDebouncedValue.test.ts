import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 300));
    expect(result.current).toBe("a");
  });

  it("delays updates until the interval has passed", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe("b");
  });

  it("collapses rapid typing into a single update", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "M" } },
    );

    for (const value of ["Mo", "Moh", "Moha", "Moham"]) {
      rerender({ value });
      act(() => void vi.advanceTimersByTime(100));
    }

    // Still the original: no full 300ms gap ever elapsed.
    expect(result.current).toBe("M");

    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe("Moham");
  });
});
