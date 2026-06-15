/** Report discography / field gaps for Morning Musume in groups.json. Run: node scripts/reportMorningMusumeGaps.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uid = "44Oi44O844OL44Oz44Kw5aiY44CC";

const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "public", "data", "groups.json"), "utf8"));
const g = j.find((x) => x?.uid === uid);
if (!g) process.exit(1);

const discs = g.discography || [];
let noTrack = 0;
let noSongUids = 0;
const sampleNoTrack = [];

for (const d of discs) {
  const tl = d.track_list;
  const tsu = d.track_song_uids;
  const notl = !tl || tl.length === 0;
  const nosu = !tsu || tsu.length === 0;
  if (notl) noTrack++;
  if (nosu) noSongUids++;
  if (notl && sampleNoTrack.length < 15) {
    sampleNoTrack.push({ title: d.title, release_date: d.release_date, disc_type: d.disc_type });
  }
}

const out = {
  catalog_name: g.name,
  formed_date: g.formed_date,
  agencies: g.agencies,
  union: g.union,
  description: g.description,
  color: g.color,
  wiki_url: g.wiki_url,
  pictures_count: (g.pictures || []).length,
  member_uids_count: (g.member_uids || []).filter(Boolean).length,
  member_count_field: g.member_count,
  song_uids_on_group: (g.song_uids || []).length,
  discography_discs: discs.length,
  discs_with_empty_track_list: noTrack,
  discs_with_empty_track_song_uids: noSongUids,
  gap_note:
    "Every disc has empty track_song_uids unless backfilled from songs.json linking. Many discs lack track_list text.",
  sample_discs_missing_track_list: sampleNoTrack,
};

console.log(JSON.stringify(out, null, 2));
