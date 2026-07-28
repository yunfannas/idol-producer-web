#!/usr/bin/env node
/**
 * Incremental ja.wikipedia 事務所 backfill for groups still missing agencies.
 * Saves after every successful fill. Resume-safe.
 *
 *   node support/scripts/fillMissingAgenciesJaWikiIncremental.mjs --only=scenario_6
 *   node support/scripts/fillMissingAgenciesJaWikiIncremental.mjs --only=main
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length) : "scenario_6";

const groupsPath =
  only === "main"
    ? path.join(root, "public/data/groups.json")
    : path.join(root, "public/data/scenarios/scenario_6/groups.json");

// Reuse parser by calling the main script's ja pass would rewrite everything;
// instead shell out to a tiny inline runner that imports duplicated logic via dynamic eval.
// Simplest: run fillGroupAgencyHistory with --wiki-ja --only=X which already has retry.

const r = spawnSync(
  process.execPath,
  ["support/scripts/fillGroupAgencyHistory.mjs", "--wiki-ja", `--only=${only}`],
  { cwd: root, stdio: "inherit", env: process.env },
);
process.exit(r.status ?? 1);
