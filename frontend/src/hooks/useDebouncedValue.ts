import { useEffect, useState } from "react";

/**
 * Delays a rapidly-changing value.
 *
 * Used for the search box so typing "Mohamed" issues one request rather
 * than seven.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
