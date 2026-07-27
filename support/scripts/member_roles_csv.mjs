/**
 * Export/import scenario member roles through CSV for manual editing.
 *
 * Examples:
 *   node support/scripts/member_roles_csv.mjs export --group "=LOVE"
 *   node support/scripts/member_roles_csv.mjs import --group "=LOVE"
 *   node support/scripts/member_roles_csv.mjs export --group "=LOVE" --scenario scenario_6
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROLE_COLUMNS = [
  "leader",
  "center",
  "lead_singer",
  "lead_dancer",
  "host",
  "content",
  "streaming",
  "style",
  "call_leader",
];

const ROLE_KEY_ALIASES = {
  performance_center: "center",
  content_lead: "content",
  youtuber: "content",
  youtube: "content",
  sns: "content",
  sns_lead: "content",
  social_media: "content",
  snser: "content",
  x: "content",
  twitter: "content",
  instagram: "content",
  tiktok: "content",
  livestream: "streaming",
  streamer: "streaming",
  showroom: "streaming",
  tiktok_live: "streaming",
  instagram_live: "streaming",
  youtube_live: "streaming",
  style_lead: "style",
  hype: "call_leader",
  hype_lead: "call_leader",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

function usage(message = "") {
  if (message) console.error(message);
  console.error(
    [
      "Usage:",
      '  node support/scripts/member_roles_csv.mjs export --group "=LOVE" [--scenario scenario_6]',
      '  node support/scripts/member_roles_csv.mjs import --group "=LOVE" [--scenario scenario_6]',
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (mode !== "export" && mode !== "import") usage(`Unknown mode: ${mode ?? "(missing)"}`);
  const options = { scenario: "scenario_6", group: "" };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--scenario") options.scenario = String(rest[i + 1] ?? "").trim();
    if (arg === "--group") options.group = String(rest[i + 1] ?? "").trim();
  }
  if (!options.group) usage("Missing required --group.");
  return { mode, ...options };
}

function scenarioFile(relativePath, scenario) {
  return path.join(root, "public", "data", "scenarios", scenario, relativePath);
}

function sanitizeFileStem(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");
}

function outCsvPath(scenario, groupName) {
  return path.join(root, "support", "docs", "reference", `${scenario}_${sanitizeFileStem(groupName)}_member_roles.csv`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function protectExcelText(value) {
  const s = value == null ? "" : String(value);
  return /^[=+\-@]/.test(s) ? `\u200B${s}` : s;
}

function csvCell(value) {
  const safe = protectExcelText(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((cellValue) => String(cellValue).trim().length > 0));
}

function toRoleNumber(value) {
  if (value == null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const num = Number(text);
  if (!Number.isFinite(num)) return 0;
  if (num > 0 && num < 1) return Math.max(0, Math.min(1, num));
  if (num <= 5) return Math.max(0, Math.min(1, num / 5));
  if (num <= 100) return Math.max(0, Math.min(1, num / 100));
  return 1;
}

function fromRoleNumber(value) {
  if (!(typeof value === "number" && Number.isFinite(value))) return "";
  if (value <= 0) return "";
  return Number((value * 5).toFixed(2)).toString();
}

function rolesFromHistoryEntry(entry) {
  const source = entry?.roles ?? entry?.member_roles ?? entry?.role_assignments;
  if (!source || typeof source !== "object") return {};
  if (Array.isArray(source)) {
    const out = {};
    for (const item of source) {
      if (typeof item === "string") out[ROLE_KEY_ALIASES[item] ?? item] = 1;
      else if (item && typeof item === "object") {
        const rawKey = String(item.key ?? item.role ?? item.id ?? "").trim();
        const key = ROLE_KEY_ALIASES[rawKey] ?? rawKey;
        const focus = toRoleNumber(item.focus ?? item.weight ?? item.scale ?? 1);
        if (key && focus > 0) out[key] = focus;
      }
    }
    return out;
  }
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    const normalizedKey = ROLE_KEY_ALIASES[key] ?? key;
    const focus = toRoleNumber(raw);
    if (focus > 0) out[normalizedKey] = focus;
  }
  return out;
}

function findGroup(groups, groupName) {
  const normalized = groupName.trim().toLowerCase();
  return (
    groups.find((group) =>
      [group.name, group.name_romanji, group.nickname]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .includes(normalized),
    ) ?? null
  );
}

function findMembershipEntry(idol, group) {
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  return (
    history.find((entry) => String(entry.group_uid ?? "").trim() === String(group.uid ?? "").trim()) ??
    history.find((entry) => String(entry.group_name ?? "").trim() === String(group.name ?? "").trim()) ??
    null
  );
}

function exportCsv({ scenario, group }) {
  const idolsPath = scenarioFile("idols.json", scenario);
  const groupsPath = scenarioFile("groups.json", scenario);
  const idols = readJson(idolsPath);
  const groups = readJson(groupsPath);
  const groupRow = findGroup(groups, group);
  if (!groupRow) throw new Error(`Group not found: ${group}`);

  const headers = [
    "idol_uid",
    "idol_name",
    "group_uid",
    "group_name",
    "start_date",
    "end_date",
    "member_color",
    ...ROLE_COLUMNS,
    "notes",
  ];

  const memberUids = Array.isArray(groupRow.member_uids) ? groupRow.member_uids.map((value) => String(value)) : [];
  const rows = [headers.join(",")];
  for (const uid of memberUids) {
    const idol = idols.find((row) => String(row.uid ?? "") === uid);
    if (!idol) continue;
    const entry = findMembershipEntry(idol, groupRow) ?? {};
    const roles = rolesFromHistoryEntry(entry);
    const line = [
      idol.uid ?? "",
      idol.name ?? "",
      groupRow.uid ?? "",
      groupRow.name ?? "",
      entry.start_date ?? "",
      entry.end_date ?? "",
      entry.member_color ?? "",
      ...ROLE_COLUMNS.map((key) => fromRoleNumber(roles[key])),
      entry.notes ?? "",
    ];
    rows.push(line.map(csvCell).join(","));
  }

  const outPath = outCsvPath(scenario, groupRow.name ?? group);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "\uFEFF" + rows.join("\r\n"), "utf8");
  console.log(`Wrote ${memberUids.length} member rows to ${path.relative(root, outPath)}`);
}

function importCsv({ scenario, group }) {
  const idolsPath = scenarioFile("idols.json", scenario);
  const groupsPath = scenarioFile("groups.json", scenario);
  const idols = readJson(idolsPath);
  const groups = readJson(groupsPath);
  const groupRow = findGroup(groups, group);
  if (!groupRow) throw new Error(`Group not found: ${group}`);

  const csvPath = outCsvPath(scenario, groupRow.name ?? group);
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${path.relative(root, csvPath)}`);
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length < 2) throw new Error("CSV is empty.");
  const [header, ...body] = rows;
  const indexByHeader = new Map(header.map((value, index) => [String(value).trim(), index]));

  const idolUidIndex = indexByHeader.get("idol_uid");
  if (idolUidIndex == null) throw new Error("CSV missing idol_uid column.");

  let updated = 0;
  for (const row of body) {
    const uid = String(row[idolUidIndex] ?? "").trim();
    if (!uid) continue;
    const idol = idols.find((item) => String(item.uid ?? "").trim() === uid);
    if (!idol) continue;
    const entry = findMembershipEntry(idol, groupRow);
    if (!entry) continue;

    const roles = {};
    for (const roleKey of ROLE_COLUMNS) {
      const idx = indexByHeader.get(roleKey);
      const focus = idx == null ? 0 : toRoleNumber(row[idx]);
      if (focus > 0) roles[roleKey] = focus;
    }
    if (Object.keys(roles).length > 0) entry.roles = roles;
    else delete entry.roles;
    updated += 1;
  }

  fs.writeFileSync(idolsPath, JSON.stringify(idols, null, 2) + "\n", "utf8");
  console.log(`Imported roles for ${updated} members into ${path.relative(root, idolsPath)}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.mode === "export") exportCsv(args);
else importCsv(args);
