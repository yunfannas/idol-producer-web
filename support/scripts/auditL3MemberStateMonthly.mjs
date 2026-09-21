#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { group: null, input: null, outDir: null, viewer: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--group") out.group = argv[++i];
    else if (a === "--input") out.input = argv[++i];
    else if (a === "--out-dir") out.outDir = argv[++i];
    else if (a === "--viewer") out.viewer = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function usage() {
  return [
    "Usage:",
    "  node support/scripts/auditL3MemberStateMonthly.mjs --group <slug> [--input <jsonl>] [--viewer <jsonl>] [--out-dir <dir>]",
    "",
    "Defaults:",
    "  source: support/tmp/l3-branch-track/lab/data/l3-world/groups/<slug>/member-state-monthly.jsonl",
    "  viewer: public/data/l3-world-viewer/groups/<slug>/member-state-monthly.jsonl",
    "  output: support/reports/l3-world-audit/<slug>/",
  ].join("\n");
}

function ymToN(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}
function monthOfDate(s) {
  const m = /^(\d{4}-\d{2})-\d{2}$/.exec(String(s || ""));
  return m ? m[1] : null;
}
function monthDiff(a, b) {
  const aa = ymToN(a), bb = ymToN(b);
  return aa == null || bb == null ? null : bb - aa;
}
function readJsonl(file) {
  const txt = fs.readFileSync(file, "utf8");
  const rows = [];
  const parseErrors = [];
  txt.split(/\r?\n/).forEach((line, idx) => {
    if (!line.trim()) return;
    try { rows.push(JSON.parse(line)); }
    catch (e) { parseErrors.push({ line: idx + 1, message: String(e?.message || e) }); }
  });
  return { txt, rows, parseErrors };
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function sevRank(s) { return ({ ERROR: 0, WARN: 1, REVIEW: 2, INFO: 3 })[s] ?? 9; }

const ATTRS = [
  ["physical","agility"],["physical","natural_fitness"],["physical","stamina"],
  ["appearance","cute"],["appearance","pretty"],
  ["performance","pitch"],["performance","tone"],["performance","breath"],
  ["performance","rhythm"],["performance","power"],["performance","stage_presence"],
  ["mental","wit"],["mental","humor"],["mental","talking"],
  ["mental","teamwork"],["mental","fashion"],["mental","creativity"],
];
const COLORS = ["red","orange","yellow","white","green","aqua","blue","purple","black","pink"];

function getAttr(m, which, g, k) { return m?.attributes?.[which]?.[g]?.[k]; }
function flattenExp(obj) {
  let sum = 0;
  for (const [g,k] of ATTRS) {
    const v = obj?.[g]?.[k];
    if (Number.isInteger(v)) sum += v;
  }
  return sum;
}

function auditRows(rows, parseErrors, group, sourcePath) {
  const findings = [];
  const add = (severity, code, message, ctx = {}) =>
    findings.push({ severity, code, message, ...ctx });

  for (const e of parseErrors) add("ERROR", "JSONL_PARSE", e.message, { line: e.line });

  if (!rows.length) add("ERROR", "EMPTY_TIMELINE", "No parsed month rows.");

  const seenMonths = new Set();
  let prevMonth = null;
  let stableUid = null, stableSlug = null;
  const prevMember = new Map();
  const firstSeen = new Map(), lastSeen = new Map();
  const fallbackCounts = new Map();
  const memberFallbackCounts = new Map();

  for (const r of rows) {
    if (!r.month || ymToN(r.month) == null) {
      add("ERROR", "INVALID_MONTH", "Invalid or missing YYYY-MM month.", { month: r.month });
      continue;
    }
    if (seenMonths.has(r.month)) add("ERROR", "DUPLICATE_MONTH", "Duplicate month row.", { month: r.month });
    seenMonths.add(r.month);

    if (prevMonth && monthDiff(prevMonth, r.month) !== 1)
      add("ERROR", "MONTH_GAP", "Timeline month is not contiguous.", { from_month: prevMonth, month: r.month });
    prevMonth = r.month;

    if (monthOfDate(r.snapshot_date) !== r.month)
      add("WARN", "SNAPSHOT_MONTH_MISMATCH", "snapshot_date does not belong to month.", { month: r.month, snapshot_date: r.snapshot_date });

    if (stableUid == null) stableUid = r.group_uid;
    else if (r.group_uid !== stableUid)
      add("ERROR", "GROUP_UID_DRIFT", "group_uid changed across timeline.", { month: r.month, expected: stableUid, actual: r.group_uid });

    if (stableSlug == null) stableSlug = r.slug;
    else if (r.slug !== stableSlug)
      add("ERROR", "SLUG_DRIFT", "slug changed across timeline.", { month: r.month, expected: stableSlug, actual: r.slug });

    const ids = new Set();
    for (const flag of r.fallback_flags || []) fallbackCounts.set(flag, (fallbackCounts.get(flag) || 0) + 1);

    const policy = r.group_policy;
    if (policy) {
      const pm = ymToN(r.month);
      const ps = policy.start ? ymToN(String(policy.start).slice(0,7)) : null;
      const pe = policy.end ? ymToN(String(policy.end).slice(0,7)) : null;
      if (ps != null && pm < ps) add("WARN", "POLICY_BEFORE_START", "Group policy emitted before its start month.", { month:r.month, policy_uid:policy.policy_uid });
      if (pe != null && pm > pe) add("WARN", "POLICY_AFTER_END", "Group policy emitted after its end month.", { month:r.month, policy_uid:policy.policy_uid });
    }

    if (r.manual_override === true && (!Array.isArray(r.override_fields) || !r.override_fields.length))
      add("WARN", "EMPTY_MANUAL_OVERRIDE_FIELDS", "manual_override=true but override_fields is empty.", { month:r.month });

    for (const m of r.members || []) {
      const id = m.member_uid;
      if (!id) add("ERROR", "MISSING_MEMBER_UID", "Member row has no member_uid.", { month:r.month, name:m.name });
      if (ids.has(id)) add("ERROR", "DUPLICATE_MEMBER_UID", "Duplicate member_uid in month.", { month:r.month, member_uid:id, name:m.name });
      ids.add(id);

      if (!firstSeen.has(id)) firstSeen.set(id, r.month);
      lastSeen.set(id, r.month);

      const start = m.membership?.start;
      const end = m.membership?.end;
      if (!start) add("ERROR", "MISSING_MEMBERSHIP_START", "membership.start is required.", { month:r.month, member_uid:id, name:m.name });
      else {
        const n = ymToN(r.month), s = ymToN(String(start).slice(0,7)), e = end ? ymToN(String(end).slice(0,7)) : null;
        if (s != null && n < s) add("ERROR", "MEMBER_BEFORE_JOIN", "Member emitted before join month.", { month:r.month, member_uid:id, name:m.name, start });
        if (e != null && n > e) add("ERROR", "MEMBER_AFTER_LEAVE", "Member emitted after leave month.", { month:r.month, member_uid:id, name:m.name, end });
      }

      for (const [g,k] of ATTRS) {
        const v = getAttr(m, "current", g, k);
        const c = getAttr(m, "ceiling", g, k);
        if (!Number.isInteger(v) || v < 0 || v > 20)
          add("ERROR", "ATTR_RANGE", "Current attribute must be integer 0..20.", { month:r.month, member_uid:id, name:m.name, attribute:`${g}.${k}`, value:v });
        if (!Number.isInteger(c) || c < 0 || c > 20)
          add("ERROR", "CEILING_RANGE", "Attribute ceiling must be integer 0..20.", { month:r.month, member_uid:id, name:m.name, attribute:`${g}.${k}`, value:c });
        if (Number.isInteger(v) && Number.isInteger(c) && v > c)
          add("ERROR", "CURRENT_ABOVE_CEILING", "Current attribute exceeds ceiling.", { month:r.month, member_uid:id, name:m.name, attribute:`${g}.${k}`, current:v, ceiling:c });
      }

      for (const field of ["morale","confidence","condition"]) {
        const v = m.status?.[field];
        if (typeof v !== "number" || v < 0 || v > 100)
          add("ERROR", "STATUS_RANGE", "Status must be numeric 0..100.", { month:r.month, member_uid:id, name:m.name, field, value:v });
      }

      const exp = m.attribute_exp;
      if (exp) {
        for (const [g,k] of ATTRS) {
          const v = exp.current?.[g]?.[k], gain = exp.month_gain?.[g]?.[k], cost = exp.next_level_cost?.[g]?.[k];
          if (!Number.isInteger(v) || v < 0) add("ERROR", "EXP_INVALID", "Attribute EXP must be non-negative integer.", { month:r.month, member_uid:id, attribute:`${g}.${k}`, value:v });
          if (!Number.isInteger(gain) || gain < 0) add("ERROR", "EXP_GAIN_INVALID", "Monthly EXP gain must be non-negative integer.", { month:r.month, member_uid:id, attribute:`${g}.${k}`, value:gain });
          if (typeof cost !== "number" || cost <= 0) add("ERROR", "NEXT_LEVEL_COST_INVALID", "next_level_cost must be positive.", { month:r.month, member_uid:id, attribute:`${g}.${k}`, value:cost });
        }
        const sum = flattenExp(exp.current), gainSum = flattenExp(exp.month_gain);
        if (sum !== exp.total) add("ERROR", "EXP_TOTAL_MISMATCH", "attribute_exp.total != sum(current).", { month:r.month, member_uid:id, expected:sum, actual:exp.total });
        if (gainSum !== exp.month_gain_total) add("ERROR", "EXP_GAIN_TOTAL_MISMATCH", "month_gain_total != sum(month_gain).", { month:r.month, member_uid:id, expected:gainSum, actual:exp.month_gain_total });
        const ids2 = exp.applied_large_live_fact_ids || [];
        if (new Set(ids2).size !== ids2.length) add("ERROR", "DUPLICATE_LARGE_LIVE_FACT", "Duplicate applied_large_live_fact_ids in member-month.", { month:r.month, member_uid:id });
      }

      const pal = m.developed_palette;
      if (pal) {
        for (const c of COLORS) {
          const v = pal.colors?.[c];
          if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
            add("ERROR", "PALETTE_VALUE_INVALID", "Palette color must be finite and non-negative.", { month:r.month, member_uid:id, color:c, value:v });
        }
        if (!COLORS.includes(pal.primary_color)) add("WARN", "PALETTE_PRIMARY_INVALID", "primary_color is not in ten-color palette.", { month:r.month, member_uid:id, value:pal.primary_color });
        if (!COLORS.includes(pal.secondary_color)) add("WARN", "PALETTE_SECONDARY_INVALID", "secondary_color is not in ten-color palette.", { month:r.month, member_uid:id, value:pal.secondary_color });
        for (const flag of pal.fallback_flags || []) memberFallbackCounts.set(flag, (memberFallbackCounts.get(flag) || 0) + 1);
      }

      const p = prevMember.get(id);
      if (p) {
        const prior = p.member, priorMonth = p.month;
        let largeAttrJumps = 0;
        for (const [g,k] of ATTRS) {
          const a = getAttr(prior, "current", g, k), b = getAttr(m, "current", g, k);
          if (Number.isInteger(a) && Number.isInteger(b)) {
            const d = b - a;
            if (d > 1) {
              largeAttrJumps++;
              add("REVIEW", "ATTR_JUMP_GT1", "Attribute increased by more than 1 in one month; require event/rebase/manual explanation.", { from_month:priorMonth, month:r.month, member_uid:id, name:m.name, attribute:`${g}.${k}`, from_value:a, to_value:b, delta:d, transition:m.transition?.attributes, source_kind:m.attributes?.source_kind });
            } else if (d < 0) {
              add("REVIEW", "ATTR_DECREASE", "Attribute decreased month-to-month; verify model permits or transition explains it.", { from_month:priorMonth, month:r.month, member_uid:id, name:m.name, attribute:`${g}.${k}`, from_value:a, to_value:b, delta:d });
            }
          }
        }
        if (largeAttrJumps >= 3)
          add("REVIEW", "MULTI_ATTR_REBASE", "Multiple attributes jumped >1 in the same transition; likely rebase/manual/event and should be explicitly sourced.", { from_month:priorMonth, month:r.month, member_uid:id, name:m.name, jump_count:largeAttrJumps, transition:m.transition?.attributes, source_kind:m.attributes?.source_kind });

        for (const field of ["morale","confidence","condition"]) {
          const a = prior.status?.[field], b = m.status?.[field];
          if (typeof a === "number" && typeof b === "number" && Math.abs(b-a) > 25)
            add("REVIEW", "STATUS_JUMP_GT25", "Large status jump needs event/health transition explanation.", { from_month:priorMonth, month:r.month, member_uid:id, name:m.name, field, from_value:a, to_value:b, delta:b-a, transition:m.status?.transition, health_event_fact_ids:m.status?.health_event_fact_ids || [] });
        }
      }
      prevMember.set(id, { month:r.month, member:m });
    }
  }

  for (const [id, first] of firstSeen) {
    const row = rows.find(r => r.month === first);
    const m = row?.members?.find(x => x.member_uid === id);
    const startMonth = m?.membership?.start ? String(m.membership.start).slice(0,7) : null;
    if (startMonth && first !== startMonth)
      add("REVIEW", "FIRST_APPEARANCE_BOUNDARY", "First emitted month differs from membership start month; verify month-end boundary or source coverage.", { member_uid:id, name:m?.name, membership_start:m?.membership?.start, first_seen_month:first });
  }

  for (const [flag,count] of fallbackCounts)
    add("INFO", "GROUP_FALLBACK_COVERAGE", "Declared group-level fallback coverage.", { fallback_flag:flag, month_count:count });
  for (const [flag,count] of memberFallbackCounts)
    add("INFO", "MEMBER_FALLBACK_COVERAGE", "Declared member/palette fallback coverage.", { fallback_flag:flag, member_month_count:count });

  findings.sort((a,b) => sevRank(a.severity) - sevRank(b.severity) || String(a.month||a.from_month||"").localeCompare(String(b.month||b.from_month||"")));
  const counts = { ERROR:0, WARN:0, REVIEW:0, INFO:0 };
  for (const f of findings) counts[f.severity]++;

  return {
    schema_version: "l3-member-state-audit/v0.1",
    group,
    source_path: sourcePath,
    generated_at: new Date().toISOString(),
    month_start: rows[0]?.month ?? null,
    month_end: rows.at(-1)?.month ?? null,
    month_rows: rows.length,
    unique_members: new Set(rows.flatMap(r => (r.members||[]).map(m => m.member_uid))).size,
    member_months: rows.reduce((n,r)=>n+(r.members?.length||0),0),
    counts,
    findings,
  };
}

function compareMirror(sourceText, viewerPath, audit) {
  if (!viewerPath || !fs.existsSync(viewerPath)) {
    audit.findings.push({ severity:"INFO", code:"VIEWER_NOT_FOUND", message:"Viewer mirror not present; parity not checked.", viewer_path:viewerPath });
    audit.counts.INFO++;
    return;
  }
  const viewerText = fs.readFileSync(viewerPath, "utf8");
  if (sourceText !== viewerText) {
    audit.findings.push({ severity:"WARN", code:"VIEWER_PARITY_MISMATCH", message:"Source and public viewer JSONL differ byte-for-byte.", viewer_path:viewerPath });
    audit.counts.WARN++;
  } else {
    audit.findings.push({ severity:"INFO", code:"VIEWER_PARITY_OK", message:"Source and public viewer JSONL are byte-identical.", viewer_path:viewerPath });
    audit.counts.INFO++;
  }
}

function mdEscape(s) { return String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " "); }
function renderMd(audit) {
  const c = audit.counts;
  const lines = [
    `# L3 member-state audit — ${audit.group}`,
    "",
    `- Source: \`${audit.source_path}\``,
    `- Range: ${audit.month_start ?? "?"} → ${audit.month_end ?? "?"}`,
    `- Month rows: ${audit.month_rows}`,
    `- Unique members: ${audit.unique_members}`,
    `- Member-months: ${audit.member_months}`,
    `- Findings: ERROR ${c.ERROR} / WARN ${c.WARN} / REVIEW ${c.REVIEW} / INFO ${c.INFO}`,
    "",
  ];
  for (const sev of ["ERROR","WARN","REVIEW","INFO"]) {
    const fs2 = audit.findings.filter(f => f.severity === sev);
    lines.push(`## ${sev} (${fs2.length})`, "");
    if (!fs2.length) { lines.push("None.", ""); continue; }
    lines.push("| Code | Month | Member | Finding |", "|---|---|---|---|");
    for (const f of fs2)
      lines.push(`| ${mdEscape(f.code)} | ${mdEscape(f.month || f.from_month || "")} | ${mdEscape(f.name || f.member_uid || "")} | ${mdEscape(f.message)} |`);
    lines.push("");
  }
  return lines.join("\n");
}

const args = parseArgs(process.argv);
if (args.help || !args.group) {
  console.log(usage());
  process.exit(args.help ? 0 : 2);
}

const group = args.group;
const preferred = path.normalize(`support/tmp/l3-branch-track/lab/data/l3-world/groups/${group}/member-state-monthly.jsonl`);
const fallback = path.normalize(`public/data/l3-world-viewer/groups/${group}/member-state-monthly.jsonl`);
const input = path.normalize(args.input || (fs.existsSync(preferred) ? preferred : fallback));
const viewer = path.normalize(args.viewer || fallback);
const outDir = path.normalize(args.outDir || `support/reports/l3-world-audit/${group}`);

if (!fs.existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(2);
}

const { txt, rows, parseErrors } = readJsonl(input);
const audit = auditRows(rows, parseErrors, group, input);
if (path.resolve(input) !== path.resolve(viewer)) compareMirror(txt, viewer, audit);
audit.findings.sort((a,b) => sevRank(a.severity) - sevRank(b.severity) || String(a.month||a.from_month||"").localeCompare(String(b.month||b.from_month||"")));

ensureDir(outDir);
fs.writeFileSync(path.join(outDir, "audit.json"), JSON.stringify(audit, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "audit.md"), renderMd(audit) + "\n");
const queue = audit.findings.filter(f => f.severity === "WARN" || f.severity === "REVIEW");
fs.writeFileSync(path.join(outDir, "review-queue.jsonl"), queue.map(x => JSON.stringify(x)).join("\n") + (queue.length ? "\n" : ""));

console.log(JSON.stringify({
  group: audit.group,
  source: audit.source_path,
  out_dir: outDir,
  ...audit.counts,
  month_rows: audit.month_rows,
  unique_members: audit.unique_members,
  member_months: audit.member_months,
}, null, 2));

process.exit(audit.counts.ERROR ? 1 : 0);
