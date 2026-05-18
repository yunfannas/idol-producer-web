import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const groups = JSON.parse(fs.readFileSync(path.join(root, "public/data/groups.json"), "utf8"));
const songs = JSON.parse(fs.readFileSync(path.join(root, "public/data/songs.json"), "utf8"));

const g = groups.find((x) => x.name === "アキシブproject");
if (!g) throw new Error("group not found");

const esc = (v) => {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function displayLabel(row) {
  const base = String(row.title ?? row.title_romanji ?? "").trim();
  if (!base) return "";
  const variant = String(row.title_variant ?? "").trim();
  const withVariant = variant ? `${base} (${variant})` : base;
  if (row.solo_track === true) {
    const whom = String(row.solo_member_name ?? "").trim();
    if (whom) return `${withVariant} · Solo (${whom})`;
  }
  return withVariant;
}

const rows = [];

rows.push([
  "row_kind",
  "uid",
  "title",
  "title_romanji",
  "title_variant",
  "title_listed",
  "display_label",
  "solo_track",
  "solo_member_uid",
  "solo_member_name",
  "release_date",
  "publisher",
  "disc_type",
  "track_song_uid_count",
  "shared_track_names",
  "track_list_text",
  "edition_track_lists_summary",
  "primary_album_name",
  "song_json_resolved",
]);

for (const d of g.discography) {
  const trackUids = d.track_song_uids ?? [];
  const shared = d.shared_track_list ?? [];
  const tl = d.track_list ?? [];
  const editions = d.edition_track_lists ?? [];
  const edSummary = editions
    .map((e) => `${e.label}: ${(e.track_list ?? []).join(" | ")}`)
    .join(" ; ");

  rows.push([
    "disc",
    d.uid,
    d.title,
    d.title_romanji ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    d.release_date ?? "",
    d.publisher ?? "",
    d.disc_type ?? "",
    String(trackUids.length),
    shared.join(" | "),
    tl.join(" | "),
    edSummary,
    "",
    "",
  ]);
}

const songIdx = new Map(songs.map((s) => [s.uid, s]));
for (const uid of g.song_uids) {
  const s = songIdx.get(uid);
  const al0 = s?.albums?.[0];
  const row = s ?? {};
  rows.push([
    "song",
    uid,
    row.title ?? "",
    row.title_romanji ?? "",
    row.title_variant ?? "",
    row.title_listed ?? "",
    s ? displayLabel(row) : "",
    row.solo_track === true ? "yes" : "",
    row.solo_member_uid ?? "",
    row.solo_member_name ?? "",
    row.release_date ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    al0?.name ?? "",
    s ? "yes" : "no",
  ]);
}

const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
const outPath = path.join(root, "docs/reference/akishibu_project_songs_discs.csv");
fs.writeFileSync(outPath, `\uFEFF${csv}`, "utf8");
console.log(`${outPath} · ${rows.length - 1} data rows (${g.song_uids.length} songs)`);
