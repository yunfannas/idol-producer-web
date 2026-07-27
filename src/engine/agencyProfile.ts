/**
 * Agency harshness + group reputation helpers for scandal evaluation.
 *
 * - Group `reputation` (1-5) lives on the group row.
 * - Agency `harshness` (1-5) lives in `public/data/reference/agencies.json`,
 *   resolved from `group.agencies[]`.
 */

export type AgencyDef = {
  id: string;
  names: string[];
  harshness: number;
  note?: string;
};

type AgencyCatalog = {
  default_harshness?: number;
  agencies: AgencyDef[];
};

let catalog: AgencyCatalog | null = null;
let loadPromise: Promise<void> | null = null;

function base(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
}

function clampScale(n: number, fallback = 3): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function preloadAgencies(): Promise<void> {
  if (catalog) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(`${base()}data/reference/agencies.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog = (await res.json()) as AgencyCatalog;
    } catch (err) {
      console.warn("[agencyProfile] preload failed", err);
      catalog = { default_harshness: 3, agencies: [] };
    }
  })();
  return loadPromise;
}

export function getAgencyDefs(): AgencyDef[] {
  return catalog?.agencies ?? [];
}

export function defaultAgencyHarshness(): number {
  return clampScale(Number(catalog?.default_harshness ?? 3) || 3, 3);
}

/** Resolve agency harshness (1-5) from a group's agencies list. */
export function agencyHarshnessFromGroup(group: Record<string, unknown> | null | undefined): number {
  const agencies = Array.isArray(group?.agencies) ? group!.agencies.map((x) => String(x)) : [];
  if (!agencies.length) return defaultAgencyHarshness();
  const defs = getAgencyDefs();
  let best: number | null = null;
  for (const raw of agencies) {
    const key = norm(raw);
    if (!key) continue;
    for (const def of defs) {
      if (def.names.some((n) => norm(n) === key) || norm(def.id) === key) {
        const h = clampScale(def.harshness, defaultAgencyHarshness());
        best = best == null ? h : Math.max(best, h);
      }
    }
  }
  return best ?? defaultAgencyHarshness();
}

/**
 * Group reputation (1-5) rounded for scandal-eval weights. Prefer the stored
 * (dynamic) `reputation` float; default is 3 when unset. Reputation evolves
 * in-engine (tenure up; scandals / unrecognized core exits down).
 */
export function groupReputationFromGroup(group: Record<string, unknown> | null | undefined): number {
  if (!group) return 3;
  const stored = Number(group.reputation);
  if (Number.isFinite(stored) && stored >= 1 && stored <= 5) return clampScale(stored, 3);
  return 3;
}

/** Primary agency label for UI / inbox copy. */
export function primaryAgencyName(group: Record<string, unknown> | null | undefined): string {
  const agencies = Array.isArray(group?.agencies) ? group!.agencies.map((x) => String(x).trim()).filter(Boolean) : [];
  return agencies[0] || "";
}
