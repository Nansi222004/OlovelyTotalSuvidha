import { useEffect, useRef, useState } from 'react';

interface UseDebouncedSuggestionsOptions<T> {
  query: string;
  isOpen: boolean;
  emptyValue: T;
  fetchSuggestions: (query: string) => Promise<T>;
  minQueryLength?: number;
  delayMs?: number;
}

/** Shared autocomplete request lifecycle used by customer and admin search. */
export function useDebouncedSuggestions<T>({
  query,
  isOpen,
  emptyValue,
  fetchSuggestions,
  minQueryLength = 2,
  delayMs = 250,
}: UseDebouncedSuggestionsOptions<T>) {
  const [data, setData] = useState<T>(emptyValue);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const sequence = ++requestSequence.current;

    if (!isOpen || trimmed.length < minQueryLength) {
      setData(emptyValue);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const nextData = await fetchSuggestions(trimmed);
        if (requestSequence.current === sequence) setData(nextData);
      } catch (error) {
        if (requestSequence.current === sequence) {
          console.error('Error fetching search suggestions:', error);
          setData(emptyValue);
        }
      } finally {
        if (requestSequence.current === sequence) setLoading(false);
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, emptyValue, fetchSuggestions, isOpen, minQueryLength, query]);

  return { data, loading };
}

