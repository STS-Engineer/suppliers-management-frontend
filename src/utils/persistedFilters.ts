/**
 * Persist a page's filter state per logged-in user across navigation/reload.
 * Without this, filters reset to defaults every time you leave a page (e.g.
 * the Purchasing Value kanban, the KPI dashboard, the SB1 supplier panel)
 * and come back — even though nothing else about the data changed.
 */

function storageKey(pageKey: string, userEmail: string): string {
  return `filters:${pageKey}:${userEmail || "anonymous"}`;
}

export function loadPersistedFilters<T>(
  pageKey: string,
  userEmail: string,
  defaults: T,
): T {
  try {
    const raw = localStorage.getItem(storageKey(pageKey, userEmail));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (
      typeof defaults === "object" &&
      defaults !== null &&
      !Array.isArray(defaults) &&
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      // Merge so a page that later adds a new filter field still gets a
      // sane default instead of undefined from an older saved blob.
      return { ...defaults, ...parsed };
    }
    return parsed as T;
  } catch {
    return defaults;
  }
}

export function savePersistedFilters<T>(
  pageKey: string,
  userEmail: string,
  value: T,
): void {
  try {
    localStorage.setItem(storageKey(pageKey, userEmail), JSON.stringify(value));
  } catch {
    // Storage unavailable (private browsing, quota) — filters just won't persist.
  }
}
