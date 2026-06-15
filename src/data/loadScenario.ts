import type {
  LoadedScenario,
  OfficialScheduleBundle,
  OfficialScheduleManifest,
  OfficialScheduleManifestEntry,
  SharedReleaseRow,
  ScenarioManifest,
  ScenarioPreset,
  ScenariosCatalogFile,
  GroupTierRow,
  ScenarioStartupAllowlist,
} from "./scenarioTypes";
import { applyAttributesToAllIdols } from "../engine/idolAttributes";

function base(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json() as Promise<unknown>;
}

export async function loadManifest(): Promise<ScenarioManifest> {
  const url = `${base()}data/scenarios/manifest.json`;
  return fetchJson(url) as Promise<ScenarioManifest>;
}

/** All scenario slots (1–6) for UX copy; see `support/docs/WEB_PORT_PLAN.md` §1a. Optional — returns null if missing. */
export async function loadScenariosCatalog(): Promise<ScenariosCatalogFile | null> {
  const url = `${base()}data/scenarios.json`;
  try {
    const data: unknown = await fetchJson(url);
    if (data && typeof data === "object" && Array.isArray((data as { scenarios?: unknown }).scenarios)) {
      return data as ScenariosCatalogFile;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadPreset(presetId: string): Promise<ScenarioPreset> {
  const url = `${base()}data/scenarios/presets/${presetId}.json`;
  return fetchJson(url) as Promise<ScenarioPreset>;
}

async function fetchJsonArray(url: string): Promise<Record<string, unknown>[]> {
  const data: unknown = await fetchJson(url);
  if (!Array.isArray(data)) throw new Error(`Expected JSON array from ${url}`);
  return data as Record<string, unknown>[];
}

async function loadOfficialScheduleBundles(groups: Record<string, unknown>[]): Promise<OfficialScheduleBundle[]> {
  try {
    const manifestUrl = `${base()}data/official_schedules/manifest.json`;
    const manifest = (await fetchJson(manifestUrl)) as OfficialScheduleManifest;
    const entries = Array.isArray(manifest?.groups) ? manifest.groups : [];
    if (!entries.length) return [];

    const scenarioGroupNames = new Set(
      groups
        .flatMap((row) => [
          String((row as { name?: unknown }).name ?? "").trim(),
          String((row as { name_romanji?: unknown }).name_romanji ?? "").trim(),
          String((row as { nickname?: unknown }).nickname ?? "").trim(),
        ])
        .filter((name) => name.length > 0)
        .map((name) => name.toLocaleLowerCase()),
    );

    const matchedEntries = entries.filter((entry: OfficialScheduleManifestEntry) => {
      const names = [entry.group_name, entry.group_key, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]
        .map((value) => String(value ?? "").trim().toLocaleLowerCase())
        .filter((value) => value.length > 0);
      return names.some((name) => scenarioGroupNames.has(name));
    });
    if (!matchedEntries.length) return [];

    const bundles = await Promise.all(
      matchedEntries.map(async (entry) => {
        const data = (await fetchJson(`${base()}data/official_schedules/${entry.file}`)) as OfficialScheduleBundle;
        return {
          ...data,
          group_key: String(data.group_key ?? entry.group_key ?? "").trim(),
          group_name: String(data.group_name ?? entry.group_name ?? "").trim(),
          aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
          file: entry.file,
          events: Array.isArray(data.events) ? data.events : [],
        } satisfies OfficialScheduleBundle;
      }),
    );
    return bundles.filter((bundle): bundle is OfficialScheduleBundle => Boolean(bundle));
  } catch {
    return [];
  }
}

async function loadSharedReleases(groups: Record<string, unknown>[]): Promise<SharedReleaseRow[]> {
  try {
    const data: unknown = await fetchJson(`${base()}data/shared_releases.json`);
    if (!Array.isArray(data)) return [];
    const groupUids = new Set(
      groups.map((row) => String((row as { uid?: unknown }).uid ?? "").trim()).filter(Boolean),
    );
    return data
      .filter((row): row is SharedReleaseRow => Boolean(row && typeof row === "object"))
      .filter((row) => {
        const releaseGroupUids = Array.isArray(row.group_uids)
          ? row.group_uids.map((uid) => String(uid ?? "").trim()).filter(Boolean)
          : [];
        return releaseGroupUids.some((uid) => groupUids.has(uid));
      });
  } catch {
    return [];
  }
}

function songsForScenarioGroups(
  groups: Record<string, unknown>[],
  songsAll: Record<string, unknown>[],
): Record<string, unknown>[] {
  const groupUids = new Set(
    groups
      .map((g) => String((g as { uid?: unknown }).uid ?? "").trim())
      .filter((u) => u.length > 0),
  );
  if (!groupUids.size || !songsAll.length) return songsAll;
  return songsAll.filter((row) => groupUids.has(String((row as { group_uid?: unknown }).group_uid ?? "").trim()));
}

/** `public/data/group_union.json` — union key → group UIDs; sets `group.union` for directory / detail. */
async function applyGroupUnionsFromCatalog(groups: Record<string, unknown>[]): Promise<void> {
  try {
    const data: unknown = await fetchJson(`${base()}data/group_union.json`);
    if (!data || typeof data !== "object") return;
    const uidToUnion = new Map<string, string>();
    for (const [unionName, block] of Object.entries(data as Record<string, unknown>)) {
      if (!block || typeof block !== "object") continue;
      const uids = (block as { group_uids?: unknown }).group_uids;
      if (!Array.isArray(uids)) continue;
      for (const raw of uids) {
        const u = String(raw ?? "").trim();
        if (u) uidToUnion.set(u, unionName);
      }
    }
    for (const g of groups) {
      const uid = String((g as { uid?: unknown }).uid ?? "").trim();
      const un = uidToUnion.get(uid);
      if (un) (g as { union?: string }).union = un;
    }
  } catch {
    /* optional */
  }
}

/** Sakamichi series groups — treat as letter tier S in UI and finance heuristics. */
const SAKAMICHI_GROUP_UIDS: ReadonlySet<string> = new Set([
  "5LmD5pyo5Z2CNDY",
  "5pel5ZCR5Z2CNDY",
  "5qu75Z2CNDY",
  "5qyF5Z2CNDY",
]);

function applySakamichiLetterTierS(groups: Record<string, unknown>[]): void {
  for (const g of groups) {
    const u = String((g as { uid?: unknown }).uid ?? "").trim();
    if (SAKAMICHI_GROUP_UIDS.has(u)) (g as { letter_tier?: string }).letter_tier = "S";
  }
}

export async function loadScenarioDatabase(preset: ScenarioPreset): Promise<LoadedScenario> {
  const root = `${base()}data/scenarios/${preset.data_subdir}/`;
  const globalSongsUrl = `${base()}data/songs.json`;

  const [idols, groups] = await Promise.all([
    fetchJsonArray(`${root}idols.json`),
    fetchJsonArray(`${root}groups.json`),
  ]);

  await applyGroupUnionsFromCatalog(groups);
  applySakamichiLetterTierS(groups);

  let songsAll: Record<string, unknown>[];
  try {
    songsAll = await fetchJsonArray(globalSongsUrl);
  } catch (err) {
    console.error(
      "[idol-producer-web] Failed to load global data/songs.json (per-track catalog). Falling back to scenario songs.json (often release-level rows only).",
      err,
    );
    songsAll = await fetchJsonArray(`${root}songs.json`);
  }

  const songs = songsForScenarioGroups(groups, songsAll);
  const shared_releases = await loadSharedReleases(groups);

  const ref =
    preset.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(preset.opening_date)
      ? preset.opening_date
      : "2020-01-01";
  applyAttributesToAllIdols(idols, groups, ref);

  let lives: Record<string, unknown>[] = [];
  try {
    const j: unknown = await fetchJson(`${base()}data/lives.json`);
    if (Array.isArray(j)) lives = j as Record<string, unknown>[];
    else if (j && typeof j === "object" && Array.isArray((j as { lives?: unknown }).lives)) {
      lives = (j as { lives: Record<string, unknown>[] }).lives;
    }
  } catch {
    /* optional catalog */
  }

  let festivals: Record<string, unknown>[] = [];
  try {
    const j: unknown = await fetchJson(`${base()}data/festivals.json`);
    if (Array.isArray(j)) festivals = j as Record<string, unknown>[];
    else if (j && typeof j === "object" && Array.isArray((j as { festivals?: unknown }).festivals)) {
      festivals = (j as { festivals: Record<string, unknown>[] }).festivals;
    }
  } catch {
    /* optional catalog */
  }

  let group_tiers: GroupTierRow[] | undefined;
  try {
    const gt: unknown = await fetchJson(`${root}group_tiers.json`);
    if (Array.isArray(gt)) group_tiers = gt as GroupTierRow[];
  } catch {
    /* optional static tiers */
  }

  let startup_allowlist: ScenarioStartupAllowlist | undefined;
  try {
    const al: unknown = await fetchJson(`${root}startup_allowlist.json`);
    if (al && typeof al === "object") {
      const o = al as { recommended_count?: unknown; names_in_order?: unknown };
      const names = Array.isArray(o.names_in_order)
        ? o.names_in_order.map((x) => String(x ?? "").trim()).filter((n) => n.length > 0)
        : [];
      const rc = typeof o.recommended_count === "number" && Number.isFinite(o.recommended_count) ? o.recommended_count : 4;
      if (names.length > 0) startup_allowlist = { recommended_count: Math.max(0, Math.min(32, Math.floor(rc))), names_in_order: names };
    }
  } catch {
    /* optional new-game allowlist */
  }

  const official_schedules = await loadOfficialScheduleBundles(groups);

  return { preset, idols, groups, songs, shared_releases, lives, festivals, group_tiers, startup_allowlist, official_schedules };
}

export async function loadDefaultScenario(): Promise<LoadedScenario> {
  const manifest = await loadManifest();
  const presetId = manifest.defaultPreset ?? manifest.presets[0];
  const preset = await loadPreset(presetId);
  return loadScenarioDatabase(preset);
}
