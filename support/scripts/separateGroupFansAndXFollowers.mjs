#!/usr/bin/env node
/**
 * Separate group Spotify fans from X (Twitter) followers.
 *
 * - `fans` / `popularity` = idolsdiagram Spotify Followers / Spotify Popularity
 * - `x_followers` = sum of active members' idol `x_followers` (desktop proxy until
 *   official group X accounts are modeled). Never mirror Spotify fans into X.
 *
 * Also cleans notes that claimed x_followers was mirrored from idolsdiagram fans.
 *
 * Usage:
 *   node support/scripts/separateGroupFansAndXFollowers.mjs
 *   node support/scripts/separateGroupFansAndXFollowers.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dryRun = process.argv.includes("--dry-run");

const FAN_AS_OF = "2025-07-01";
const FAN_SOURCE = "idolsdiagram_spotify";
const X_SOURCE = "member_x_followers_sum";
const MIRROR_NOTE_RE =
  /Group X followers mirrored from idolsdiagram fans snapshot; treated as mid-2025 \(as_of 2025-07-01\)\.?\s*/g;

const targets = [
  {
    label: "scenario_6",
    groupsPath: path.join(root, "public/data/scenarios/scenario_6/groups.json"),
    idolsPath: path.join(root, "public/data/scenarios/scenario_6/idols.json"),
    openingDate: "2025-07-05",
  },
  {
    label: "main",
    groupsPath: path.join(root, "public/data/groups.json"),
    idolsPath: path.join(root, "public/data/idols.json"),
    openingDate: null, // current roster: undated/open-ended histories count as active
  },
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, value) {
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isoDay(value) {
  return typeof value === "string" && value ? value.slice(0, 10) : "";
}

function historyMatchesGroup(history, group) {
  if (typeof history.group_uid === "string" && history.group_uid && history.group_uid === group.uid) {
    return true;
  }
  const name = typeof history.group_name === "string" ? history.group_name.trim() : "";
  return Boolean(name) && (name === group.name || name === group.name_romanji);
}

function historyActiveOn(history, openingDate) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (openingDate) {
    if (!start) return false;
    if (start > openingDate) return false;
    if (end && end < openingDate) return false;
    return true;
  }
  // Main DB "current": require start; no end (or empty end).
  if (!start) return false;
  if (end) return false;
  return true;
}

function stripMirrorNote(notes) {
  if (typeof notes !== "string" || !notes) return notes;
  const next = notes.replace(MIRROR_NOTE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return next || undefined;
}

function processTarget(target) {
  const groups = readJson(target.groupsPath);
  const idols = readJson(target.idolsPath);
  const openingDate = target.openingDate;

  let fansTagged = 0;
  let xSet = 0;
  let xCleared = 0;
  let notesCleaned = 0;
  let sameAsFansBefore = 0;
  const samples = [];

  for (const g of groups) {
    const fans = typeof g.fans === "number" && Number.isFinite(g.fans) ? Math.round(g.fans) : Number(g.fans ?? 0) || 0;
    const prevX =
      typeof g.x_followers === "number" && Number.isFinite(g.x_followers)
        ? Math.round(g.x_followers)
        : Number(g.x_followers ?? 0) || 0;
    if (fans > 0 && prevX === fans) sameAsFansBefore += 1;

    if (fans > 0) {
      g.fans = fans;
      g.fans_source = FAN_SOURCE;
      g.fans_as_of = FAN_AS_OF;
      fansTagged += 1;
    }

    let memberSum = 0;
    let membersWithX = 0;
    let activeMembers = 0;
    for (const idol of idols) {
      const histories = Array.isArray(idol.group_history) ? idol.group_history : [];
      let active = false;
      for (const history of histories) {
        if (!historyMatchesGroup(history, g)) continue;
        if (historyActiveOn(history, openingDate)) {
          active = true;
          break;
        }
      }
      if (!active) continue;
      activeMembers += 1;
      const ix =
        typeof idol.x_followers === "number" && Number.isFinite(idol.x_followers)
          ? Math.max(0, Math.round(idol.x_followers))
          : Number(idol.x_followers ?? 0) || 0;
      if (ix > 0) {
        memberSum += ix;
        membersWithX += 1;
      }
    }

    if (memberSum > 0) {
      g.x_followers = memberSum;
      g.x_followers_source = X_SOURCE;
      g.x_followers_as_of = openingDate || FAN_AS_OF;
      g.x_followers_member_coverage = `${membersWithX}/${activeMembers}`;
      xSet += 1;
    } else {
      // Do not keep Spotify-mirrored values.
      if (prevX > 0) xCleared += 1;
      delete g.x_followers;
      delete g.x_followers_source;
      delete g.x_followers_as_of;
      delete g.x_followers_member_coverage;
    }

    const cleaned = stripMirrorNote(g.notes);
    if (cleaned !== g.notes) {
      if (cleaned === undefined) delete g.notes;
      else g.notes = cleaned;
      notesCleaned += 1;
    }

    if (samples.length < 8 && fans > 0) {
      samples.push({
        name: g.name,
        fans_spotify: fans,
        x_member_sum: memberSum || null,
        coverage: memberSum > 0 ? `${membersWithX}/${activeMembers}` : `${membersWithX}/${activeMembers}`,
      });
    }
  }

  if (!dryRun) writeJson(target.groupsPath, groups);

  return {
    label: target.label,
    groups: groups.length,
    fans_tagged_spotify: fansTagged,
    x_set_from_member_sum: xSet,
    x_cleared_no_member_data: xCleared,
    notes_cleaned: notesCleaned,
    same_as_fans_before: sameAsFansBefore,
    samples,
  };
}

const results = targets.map(processTarget);
console.log(JSON.stringify({ dry_run: dryRun, results }, null, 2));
