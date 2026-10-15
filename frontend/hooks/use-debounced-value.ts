"use client";

import { useEffect, useState } from "react";

/**
 * Valeur retardée (T-48) : renvoie `value` après `delayMs` sans changement —
 * pour les recherches qui ne doivent pas requêter à chaque frappe.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
