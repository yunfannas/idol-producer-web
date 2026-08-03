/**
 * Standalone formation editor at `/formation-editor/`.
 * Loads Scenario 6 catalog data; saves JSON downloads (does not write the repo).
 */

import "./style.css";
import {
  loadSongFormationCatalog,
  normalizeSongStartingFormation,
  resolveSongFormation,
  type SongFormationCatalog,
} from "./data/songStartingFormation";
import {
  bindFormationEditor,
  createFormationEditorState,
  renderFormationEditor,
  type FormationEditorMember,
  type FormationEditorState,
} from "./ui/formationEditor";
import { resolvePublicAssetUrl } from "./ui/portraitUrl";
import type { UiLanguage } from "./ui/i18n";

const appElt = document.querySelector<HTMLDivElement>("#app");
if (!appElt) throw new Error("#app missing");
const app: HTMLDivElement = appElt;

const lang: UiLanguage = "en";
const REF_DATE = "2025-07-05";

type IdolRow = Record<string, unknown>;
type GroupRow = Record<string, unknown>;
type SongRow = Record<string, unknown>;

let groups: GroupRow[] = [];
let idols: IdolRow[] = [];
let songs: SongRow[] = [];
let catalog: SongFormationCatalog = { schemaVersion: "0.1", formations: {} };
let selectedGroupUid = "";
let selectedSongUid = "";
let editorState: FormationEditorState | null = null;
let status = "Loading catalog…";

function idolName(row: IdolRow): string {
  return String(row.name ?? row.name_romanji ?? row.uid ?? "—").trim() || "—";
}

function idolColor(row: IdolRow): string {
  const c = String(row.color_code ?? row.color ?? "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#94a3b8";
}

function groupName(row: GroupRow): string {
  return String(row.name ?? row.name_romanji ?? row.uid ?? "—").trim() || "—";
}

function songTitle(row: SongRow): string {
  return String(row.title ?? row.title_romanji ?? row.uid ?? "—").trim() || "—";
}

function membersForGroup(groupUid: string): FormationEditorMember[] {
  const group = groups.find((g) => String(g.uid ?? "") === groupUid);
  const uids = Array.isArray(group?.member_uids) ? group!.member_uids.map(String) : [];
  const byUid = new Map(idols.map((i) => [String(i.uid ?? ""), i] as const));
  return uids
    .map((uid) => byUid.get(uid))
    .filter((row): row is IdolRow => !!row)
    .map((row) => ({
      uid: String(row.uid ?? ""),
      name: idolName(row),
      color: idolColor(row),
      idol: row,
    }));
}

function songsForGroup(groupUid: string): SongRow[] {
  return songs
    .filter((s) => String(s.group_uid ?? "") === groupUid)
    .sort((a, b) => songTitle(a).localeCompare(songTitle(b), "ja"));
}

function openEditorForSelection(): void {
  if (!selectedGroupUid || !selectedSongUid) {
    editorState = null;
    status = "Pick a group and song.";
    paint();
    return;
  }
  const song = songs.find((s) => String(s.uid ?? "") === selectedSongUid);
  const members = membersForGroup(selectedGroupUid);
  if (!members.length) {
    editorState = null;
    status = "Group has no members in the snapshot.";
    paint();
    return;
  }
  const existing = resolveSongFormation({
    songUid: selectedSongUid,
    catalog,
    saveOverrides: null,
  });
  editorState = createFormationEditorState({
    songUid: selectedSongUid,
    songTitle: song ? songTitle(song) : selectedSongUid,
    groupUid: selectedGroupUid,
    asOfDate: REF_DATE,
    members,
    formation: existing,
  });
  status = existing ? `Loaded formation (${existing.source}).` : "New formation — assign manually or mark from video.";
  paint();
}

function paint(): void {
  const groupOptions = groups
    .slice()
    .sort((a, b) => groupName(a).localeCompare(groupName(b), "ja"))
    .map((g) => {
      const uid = String(g.uid ?? "");
      const selected = uid === selectedGroupUid ? " selected" : "";
      return `<option value="${uid}"${selected}>${groupName(g)}</option>`;
    })
    .join("");

  const songOptions = songsForGroup(selectedGroupUid)
    .map((s) => {
      const uid = String(s.uid ?? "");
      const selected = uid === selectedSongUid ? " selected" : "";
      return `<option value="${uid}"${selected}>${songTitle(s)}</option>`;
    })
    .join("");

  const editorHtml = editorState
    ? renderFormationEditor(editorState, lang, { showClose: false })
    : `<p class="formation-editor-muted">${status}</p>`;

  app.innerHTML = `
    <nav class="formation-editor-standalone-nav">
      <a href="../">← Idol Producer Game</a>
      <strong>Formation Editor</strong>
      <a href="./choreography-player.html">Choreography player</a>
      <span class="formation-editor-muted">${status}</span>
    </nav>
    <div class="formation-editor-standalone-controls">
      <label>Group
        <select data-standalone-group>
          <option value="">—</option>
          ${groupOptions}
        </select>
      </label>
      <label>Song
        <select data-standalone-song>
          <option value="">—</option>
          ${songOptions}
        </select>
      </label>
      <button type="button" class="fm-btn" data-standalone-reload>Reload formation</button>
      <label class="fm-btn formation-editor-file-btn">Import JSON
        <input type="file" accept="application/json,.json" data-standalone-import hidden />
      </label>
    </div>
    <div data-standalone-editor>${editorHtml}</div>
  `;

  app.querySelector<HTMLSelectElement>("[data-standalone-group]")?.addEventListener("change", (ev) => {
    selectedGroupUid = (ev.target as HTMLSelectElement).value;
    selectedSongUid = "";
    openEditorForSelection();
  });
  app.querySelector<HTMLSelectElement>("[data-standalone-song]")?.addEventListener("change", (ev) => {
    selectedSongUid = (ev.target as HTMLSelectElement).value;
    openEditorForSelection();
  });
  app.querySelector("[data-standalone-reload]")?.addEventListener("click", () => openEditorForSelection());
  app.querySelector<HTMLInputElement>("[data-standalone-import]")?.addEventListener("change", async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { parseChoreographicCompat, choreographicDocToSongStartingFormation } = await import("./data/choreographicCompat");
      const choreo = parseChoreographicCompat(json);
      if (choreo) {
        if (choreo.groupUid) selectedGroupUid = choreo.groupUid;
        if (choreo.songUid) selectedSongUid = choreo.songUid;
        const formation = choreographicDocToSongStartingFormation(choreo, {
          songUid: selectedSongUid || choreo.songUid || "imported-song",
        });
        catalog.formations[formation.songUid] = formation;
        selectedSongUid = formation.songUid;
        openEditorForSelection();
        status = `Imported Choreographic-compatible JSON (${choreo.formations.length} sets).`;
        return;
      }
      const parsed = normalizeSongStartingFormation(json);
      if (!parsed) throw new Error("invalid formation");
      selectedSongUid = parsed.songUid;
      if (parsed.groupUid) selectedGroupUid = parsed.groupUid;
      catalog.formations[parsed.songUid] = parsed;
      openEditorForSelection();
      status = `Imported ${parsed.songUid}.`;
    } catch {
      status = "Import failed — use Choreographic-compat JSON or SongStartingFormation.";
      paint();
    }
  });

  const editorRoot = app.querySelector("[data-standalone-editor]");
  if (editorState && editorRoot) {
    bindFormationEditor(editorRoot, editorState, lang, {
      onChange: (next) => {
        editorState = next;
        paint();
      },
      onSave: (formation) => {
        catalog.formations[formation.songUid] = formation;
        const blob = new Blob(
          [JSON.stringify({ schemaVersion: "0.1", formations: { [formation.songUid]: formation } }, null, 2) + "\n"],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `song_starting_formation_${formation.songUid.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        status = "Saved locally (download). Merge into public/data/song_starting_formations.json to publish.";
        editorState = { ...editorState!, formation, statusMessage: status };
        paint();
      },
    });
  }
}

async function boot(): Promise<void> {
  const [groupsRes, idolsRes, songsRes, formations] = await Promise.all([
    fetch(resolvePublicAssetUrl("data/scenarios/scenario_6/groups.json")),
    fetch(resolvePublicAssetUrl("data/scenarios/scenario_6/idols.json")),
    fetch(resolvePublicAssetUrl("data/scenarios/scenario_6/songs.json")),
    loadSongFormationCatalog(true),
  ]);
  if (!groupsRes.ok || !idolsRes.ok || !songsRes.ok) {
    status = "Failed to load scenario_6 catalog JSON.";
    paint();
    return;
  }
  groups = await groupsRes.json();
  idols = await idolsRes.json();
  songs = await songsRes.json();
  catalog = formations;
  status = `Loaded ${groups.length} groups · ${songs.length} songs · ${Object.keys(catalog.formations).length} formations.`;
  paint();
}

void boot();
