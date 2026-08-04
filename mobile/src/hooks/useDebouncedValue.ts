import { useEffect, useState } from 'react';

/**
 * Keep text entry responsive while deferring CPU-heavy derived models until
 * the user pauses briefly. The latest value always wins and pending timers are
 * cancelled on replacement/unmount.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), Math.max(0, delayMs));
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}
