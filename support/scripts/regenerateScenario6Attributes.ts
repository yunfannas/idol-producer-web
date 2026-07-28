/**
 * Persist regenerated attributes into scenario_6/idols.json.
 * Keeps existing manual attribute blocks for:
 *   iLiFE!, 高嶺のなでしこ, アキシブproject
 * Also keeps =LOVE manuals (curated calibration set) unless --force-love is passed.
 *
 * Usage:
 *   npx vite-node support/scripts/regenerateScenario6Attributes.ts
 *   npx vite-node support/scripts/regenerateScenario6Attributes.ts --force-love
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAttributesFromFollowerModel,
  buildGroupLetterTierIndex,
  buildGroupPopularityIndex,
  buildWithinGroupXRankBoosts,
  getAbility,
  hasPersistedAttributeBlock,
  reconcileGeneratedAbilityOrderByX,
  type PersistedIdolAttributes,
  type RoleAttributeModel,
} from "../../src/engine/idolAttributes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const KEEP_MANUAL_GROUPS = new Set(["iLiFE!", "高嶺のなでしこ", "アキシブproject"]);
const forceLove = process.argv.includes("--force-love");

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as T;
}

function writeJson(rel: string, value: unknown): void {
  fs.writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

type IdolRow = Record<string, unknown> & {
  uid?: string;
  name?: string;
  attributes?: PersistedIdolAttributes;
  group_history?: Record<string, unknown>[];
};

type GroupRow = Record<string, unknown> & {
  uid?: string;
  name?: string;
  member_uids?: string[];
  member_names?: string[];
  letter_tier?: string;
};

function membershipActiveAt(entry: Record<string, unknown>, openingIso: string): boolean {
  const startRaw = entry.start_date;
  if (typeof startRaw !== "string") return false;
  const start = startRaw.trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start > openingIso) return false;
  const endRaw = entry.end_date;
  if (endRaw == null || endRaw === "") return true;
  if (typeof endRaw !== "string") return false;
  const end = endRaw.trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  return openingIso < end;
}

function activeGroupNames(idol: IdolRow, openingIso: string): string[] {
  const names: string[] = [];
  for (const raw of Array.isArray(idol.group_history) ? idol.group_history : []) {
    if (!raw || typeof raw !== "object") continue;
    if (!membershipActiveAt(raw, openingIso)) continue;
    const name = String(raw.group_name ?? "").trim();
    if (name) names.push(name);
  }
  return names;
}

function main(): void {
  const preset = readJson<{ opening_date?: string }>("public/data/scenarios/presets/scenario6.json");
  const openingIso =
    typeof preset.opening_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(preset.opening_date)
      ? preset.opening_date
      : "2025-07-05";

  const idols = readJson<IdolRow[]>("public/data/scenarios/scenario_6/idols.json");
  const groups = readJson<GroupRow[]>("public/data/scenarios/scenario_6/groups.json");
  let model: RoleAttributeModel | null = null;
  try {
    model = readJson<RoleAttributeModel>("public/data/member_role_attribute_model.json");
  } catch {
    model = null;
  }

  const keepUids = new Set<string>();
  for (const group of groups) {
    const name = String(group.name ?? "");
    const keepLove = name === "=LOVE" && !forceLove;
    if (!KEEP_MANUAL_GROUPS.has(name) && !keepLove) continue;
    for (const uid of Array.isArray(group.member_uids) ? group.member_uids : []) {
      keepUids.add(String(uid));
    }
  }

  const groupPopularity = buildGroupPopularityIndex(groups as Record<string, unknown>[]);
  const groupLetterTiers = buildGroupLetterTierIndex(groups as Record<string, unknown>[]);
  const withinGroupXBoosts = buildWithinGroupXRankBoosts(
    idols as Record<string, unknown>[],
    groups as Record<string, unknown>[],
    openingIso,
  );
  /** Preserve every explicit manual block; legacy untagged blocks only in keep-groups / =LOVE. */
  const preservedManuals = new Map<string, PersistedIdolAttributes>();
  for (const idol of idols) {
    const uid = String(idol.uid ?? "");
    if (!uid || !hasPersistedAttributeBlock(idol.attributes)) continue;
    const origin = String((idol as { attributes_origin?: unknown }).attributes_origin ?? "").trim();
    if (origin === "generated") continue;
    if (origin === "manual") {
      preservedManuals.set(uid, structuredClone(idol.attributes as PersistedIdolAttributes));
      continue;
    }
    // Legacy rows with no origin: keep only if in requested keep groups / =LOVE calibration.
    const names = activeGroupNames(idol, openingIso);
    const inRequestedKeep = names.some((n) => KEEP_MANUAL_GROUPS.has(n)) || keepUids.has(uid);
    const inLoveKeep = !forceLove && (names.includes("=LOVE") || keepUids.has(uid));
    if (inRequestedKeep || inLoveKeep) {
      preservedManuals.set(uid, structuredClone(idol.attributes as PersistedIdolAttributes));
    }
  }

  let kept = 0;
  let regenerated = 0;
  const spotRows: Record<string, { name: string; ability: number; source: string }[]> = {};

  for (const idol of idols) {
    const uid = String(idol.uid ?? "");
    const preserved = uid ? preservedManuals.get(uid) : undefined;
    if (preserved) {
      idol.attributes = preserved;
      (idol as { attributes_origin?: string }).attributes_origin = "manual";
      kept += 1;
      continue;
    }

    delete idol.attributes;
    idol.attributes = buildAttributesFromFollowerModel(
      idol,
      groupPopularity,
      openingIso,
      model,
      groupLetterTiers,
      withinGroupXBoosts,
    );
    (idol as { attributes_origin?: string }).attributes_origin = "generated";
    regenerated += 1;
  }

  reconcileGeneratedAbilityOrderByX(
    idols as Record<string, unknown>[],
    groups as Record<string, unknown>[],
    openingIso,
  );

  writeJson("public/data/scenarios/scenario_6/idols.json", idols);

  for (const groupName of ["#2i2", "iLiFE!", "高嶺のなでしこ", "アキシブproject", "=LOVE"]) {
    const group = groups.find((g) => g.name === groupName);
    if (!group) continue;
    const uids = new Set((group.member_uids ?? []).map(String));
    spotRows[groupName] = idols
      .filter((i) => uids.has(String(i.uid ?? "")))
      .map((i) => ({
        name: String(i.name ?? i.uid),
        ability: i.attributes ? getAbility(i.attributes) : -1,
        source: preservedManuals.has(String(i.uid ?? "")) ? "manual-keep" : "generated",
      }))
      .sort((a, b) => b.ability - a.ability);
  }

  console.log(
    JSON.stringify(
      {
        openingIso,
        kept_manual: kept,
        regenerated,
        forceLove,
        keepGroups: [...KEEP_MANUAL_GROUPS, ...(forceLove ? [] : ["=LOVE (calibration)"])],
        spot: spotRows,
      },
      null,
      2,
    ),
  );
}

main();
