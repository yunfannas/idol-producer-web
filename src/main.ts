import "./style.css";
import type { WebPreviewBundle } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app missing");
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadBundle(): Promise<WebPreviewBundle> {
  const url = `${import.meta.env.BASE_URL}data/preview.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json() as Promise<WebPreviewBundle>;
}

function render(bundle: WebPreviewBundle): void {
  const g = bundle.group;
  const opening = bundle.opening_date ?? "—";
  const scenario = bundle.scenario_number != null ? String(bundle.scenario_number) : "—";

  const idolRows = bundle.idols
    .map((i) => {
      const color = i.group_history_in_group[0]?.member_color ?? "";
      const colorNote = color ? ` · ${esc(color)}` : "";
      return `<li><span class="name">${esc(i.name)}</span><span class="romaji">${esc(
        i.romaji ?? "",
      )}</span><span class="romaji">${esc(i.birthday ?? "")}${colorNote}</span></li>`;
    })
    .join("");

  const discs = g.discography
    .map((d) => {
      const tracks = (d.track_list ?? [])
        .slice(0, 12)
        .map((t) => `<li>${esc(t)}</li>`)
        .join("");
      const trackBlock = tracks ? `<ol class="tracks">${tracks}</ol>` : "";
      return `<div class="disc"><strong>${esc(d.title ?? "")}</strong> (${esc(
        d.disc_type ?? "",
      )}, ${esc(d.release_date ?? "")})${trackBlock}</div>`;
    })
    .join("");

  app.innerHTML = `
    <h1>${esc(g.name)}</h1>
    <p class="sub">${esc(g.name_romanji)} · Scenario ${scenario} · Start ${esc(opening)}</p>

    <div class="panel">
      <h2>Group</h2>
      <p class="meta">${esc(g.nickname ?? "")} · ${g.fans != null ? `${g.fans.toLocaleString()} fans` : ""} · pop ${
        g.popularity ?? "—"
      }</p>
      <p>${esc(g.description)}</p>
    </div>

    <div class="panel">
      <h2>Members (${bundle.export_notes.idol_count})</h2>
      <ul class="members">${idolRows}</ul>
    </div>

    <div class="panel">
      <h2>Sample discography</h2>
      ${discs}
    </div>

    <p class="meta">Bundle preset <code>${esc(bundle.preset)}</code> · v${bundle.bundle_version}</p>
  `;
}

loadBundle()
  .then(render)
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    app.innerHTML = `<div class="err"><strong>Could not load game data.</strong><br />${esc(msg)}</div>`;
  });
