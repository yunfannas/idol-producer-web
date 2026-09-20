const COLORS = ["red", "orange", "yellow", "white", "green", "aqua", "blue", "purple", "black", "pink"];
const COLOR_CSS = {
  red: "var(--c-red)",
  orange: "var(--c-orange)",
  yellow: "var(--c-yellow)",
  white: "var(--c-white)",
  green: "var(--c-green)",
  aqua: "var(--c-aqua)",
  blue: "var(--c-blue)",
  purple: "var(--c-purple)",
  black: "var(--c-black)",
  pink: "var(--c-pink)",
};

/** @type {any} */
const state = {
  manifest: null,
  monthsIndex: null,
  tiersBySlug: new Map(),
  paletteBySlug: new Map(),
  membersBySlug: new Map(),
  worldPalette: new Map(),
  rankByMonth: new Map(),
  revisions: [],
  month: "2022-11",
  groupSlug: "akishibu",
  tab: "group",
  mode: "view",
  memberUid: null,
  draft: null,
  auth: { login: null, can_edit: false },
  dirty: false,
};

const AUTH_API = (() => {
  const params = new URLSearchParams(location.search);
  return params.get("auth") || localStorage.getItem("worldSimAuthApi") || "";
})();

function dataUrl(rel) {
  return new URL(`../data/l3-world-viewer/${rel}`, import.meta.url).href;
}

async function fetchJson(rel) {
  const res = await fetch(dataUrl(rel));
  if (!res.ok) throw new Error(`Failed ${rel}: ${res.status}`);
  return res.json();
}

async function fetchJsonl(rel) {
  const res = await fetch(dataUrl(rel));
  if (!res.ok) throw new Error(`Failed ${rel}: ${res.status}`);
  const text = await res.text();
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function assertManifestContract(manifest) {
  const contract = manifest?.data_contract;
  const layers = [...(contract?.direct_input_layers || [])].sort().join(",");
  if (
    manifest?.schema_version !== "l3-world-viewer-bundle/v2" ||
    contract?.contract_version !== "l3-viewer-input/v1" ||
    layers !== "L1,L2" ||
    contract?.legacy_runtime_inputs !== false ||
    contract?.web_legacy_catalogs !== false
  ) {
    throw new Error("L3 bundle rejected: canonical L1/L2-only contract is missing");
  }
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "");
  const p = new URLSearchParams(raw);
  return {
    tab: ["group", "world", "idol"].includes(p.get("tab")) ? p.get("tab") : "group",
    month: p.get("m") || null,
    group: p.get("g") || null,
    idol: p.get("i") || null,
    mode: p.get("mode") === "edit" ? "edit" : "view",
  };
}

function writeHash() {
  const p = new URLSearchParams();
  p.set("tab", state.tab);
  p.set("m", state.month);
  p.set("g", state.groupSlug);
  if (state.memberUid) p.set("i", state.memberUid);
  p.set("mode", state.mode);
  history.replaceState(null, "", `#${p.toString()}`);
}

function applyOverrides(bundleRows) {
  // Export already merges Lab overrides. Client hook for future revision folding.
  return bundleRows;
}

function foldRevisions() {
  // Apply published revisions in saved_at order onto in-memory maps.
  const sorted = [...state.revisions].sort((a, b) => String(a.saved_at).localeCompare(String(b.saved_at)));
  for (const rev of sorted) {
    for (const patch of rev.patches?.group_monthly || []) {
      const slug = state.manifest.groups.find((g) => g.group_uid === patch.group_uid)?.slug;
      if (!slug) continue;
      const map = state.tiersBySlug.get(slug);
      if (!map) continue;
      const row = map.get(patch.month);
      if (!row) continue;
      Object.assign(row, patch.set || {});
      if (patch.set?.tier_scores) row.tier_scores = { ...row.tier_scores, ...patch.set.tier_scores };
      if (patch.set?.tiers) row.tiers = { ...row.tiers, ...patch.set.tiers };
      if (patch.set?.team_palette) row.team_palette = { ...row.team_palette, ...patch.set.team_palette };
      row.manual_override = true;
      const pmap = state.paletteBySlug.get(slug);
      if (pmap?.get(patch.month) && patch.set?.team_palette) {
        const prow = pmap.get(patch.month);
        prow.palette = { ...prow.palette, ...patch.set.team_palette };
        prow.manual_override = true;
      }
    }
    for (const patch of rev.patches?.member_monthly || []) {
      for (const [, mmap] of state.membersBySlug) {
        const row = mmap.get(patch.month);
        if (!row) continue;
        row.members = (row.members || []).map((m) =>
          m.member_uid === patch.member_uid ? { ...m, ...patch.set, manual_override: true } : m
        );
      }
    }
    for (const patch of rev.patches?.world_monthly || []) {
      const w = state.worldPalette.get(patch.month);
      if (!w) continue;
      w.palette = { ...(w.palette || {}), ...(patch.set?.palette || {}) };
      w.present = true;
      w.manual_override = true;
    }
  }
}

async function loadAll() {
  state.manifest = await fetchJson("manifest.json");
  assertManifestContract(state.manifest);
  state.monthsIndex = await fetchJson("index/months.json");
  const worldPal = applyOverrides(await fetchJsonl("world/palette-monthly.jsonl"));
  const ranks = applyOverrides(await fetchJsonl("world/rank-monthly.jsonl"));
  state.worldPalette = new Map(worldPal.map((r) => [r.month, r]));
  state.rankByMonth = new Map(ranks.map((r) => [r.month, r]));

  for (const g of state.manifest.groups) {
    const tiers = applyOverrides(await fetchJsonl(`groups/${g.slug}/tiers-monthly.jsonl`));
    const pals = applyOverrides(await fetchJsonl(`groups/${g.slug}/team-palette-monthly.jsonl`));
    const mems = applyOverrides(await fetchJsonl(`groups/${g.slug}/member-state-monthly.jsonl`));
    state.tiersBySlug.set(g.slug, new Map(tiers.map((r) => [r.month, r])));
    state.paletteBySlug.set(g.slug, new Map(pals.map((r) => [r.month, r])));
    state.membersBySlug.set(g.slug, new Map(mems.map((r) => [r.month, r])));
  }

  try {
    const idx = await fetchJson("revisions/index.json");
    const list = idx.revisions || [];
    state.revisions = [];
    for (const item of list) {
      if (item.path) {
        try {
          state.revisions.push(await fetchJson(item.path.replace(/^\/?/, "").replace(/^public\/data\/l3-world-viewer\//, "")));
        } catch {
          if (item.file) state.revisions.push(await fetchJson(`revisions/${item.file}`));
        }
      } else if (item.file) {
        state.revisions.push(await fetchJson(`revisions/${item.file}`));
      }
    }
    foldRevisions();
  } catch {
    state.revisions = [];
  }
}

function currentTier() {
  return state.tiersBySlug.get(state.groupSlug)?.get(state.month) || null;
}
function currentPalette() {
  return state.paletteBySlug.get(state.groupSlug)?.get(state.month) || null;
}
function currentMembers() {
  return state.membersBySlug.get(state.groupSlug)?.get(state.month) || null;
}

function renderPalette(el, palette, opts = {}) {
  if (!palette) {
    el.innerHTML = `<p class="muted">${opts.empty || "No palette this month."}</p>`;
    return;
  }
  const parts = COLORS.map((c) => ({ c, v: Number(palette[c] || 0) }));
  const sum = parts.reduce((a, b) => a + b.v, 0) || 1;
  const bar = parts
    .filter((p) => p.v > 0)
    .map((p) => `<span style="width:${(p.v / sum) * 100}%;background:${COLOR_CSS[p.c]}" title="${p.c}: ${p.v}"></span>`)
    .join("");
  const editable = state.mode === "edit" && opts.editable;
  const inputs = editable
    ? `<div class="palette-grid">${COLORS.map(
        (c) =>
          `<label>${c}<input data-pal-color="${c}" type="number" min="0" max="1" step="0.001" value="${Number(palette[c] || 0)}" /></label>`
      ).join("")}</div>`
    : "";
  const dynamics = opts.snapshot ? renderPaletteDynamics(opts.snapshot) : "";
  el.innerHTML = `
    <div class="palette-bar">${bar}</div>
    <div class="palette-meta">
      primary <strong>${palette.primary_color || "—"}</strong>
      / secondary <strong>${palette.secondary_color || "—"}</strong>
      ${palette.manual_override || opts.manual ? '<span class="badge">manual</span>' : ""}
    </div>
    ${dynamics}
    ${inputs}
  `;
  if (editable) {
    el.querySelectorAll("input[data-pal-color]").forEach((input) => {
      input.addEventListener("change", () => {
        ensureDraft();
        const color = input.getAttribute("data-pal-color");
        state.draft.team_palette = state.draft.team_palette || { ...(currentPalette()?.palette || {}) };
        state.draft.team_palette[color] = Number(input.value);
        state.dirty = true;
        updateModeChrome();
      });
    });
  }
}

function renderPaletteDynamics(snapshot) {
  if (!snapshot?.model) return "";
  const injections = snapshot.injections || {};
  const catalog = snapshot.catalog || {};
  const contributions = snapshot.contributions || [];
  const catalogEntries = injections.catalog_entries?.length || 0;
  const releases = injections.releases?.length || 0;
  const promotions = injections.promotion_signals?.length || 0;
  const setlistEvents = injections.setlists?.length || 0;
  const setlistSongs = injections.resolved_setlist_song_occurrences || 0;
  const coverage = snapshot.fallback_flags?.verified_setlist_coverage_partial
    ? '<span class="badge warning">partial setlist coverage</span>'
    : '<span class="badge">setlist coverage verified</span>';
  const promotionCoverage = snapshot.fallback_flags?.promotion_coverage_partial
    ? '<span class="badge warning">partial promotion coverage</span>'
    : '<span class="badge">promotion coverage verified</span>';
  const topSongs = contributions.length
    ? `<ol class="palette-contributions">${contributions.slice(0, 5).map((song) => `
        <li><span>${escapeHtml(song.title)}</span><strong>${(Number(song.share || 0) * 100).toFixed(1)}%</strong><small>current rank ${Number(song.popularity).toFixed(1)} → ${Number(song.popularity_multiplier || 1).toFixed(2)}×; exposure ${Number(song.exposure).toFixed(2)}</small></li>`).join("")}</ol>`
    : '<p class="muted">No eligible songs with both reviewed popularity and palette.</p>';
  return `
    <div class="palette-dynamics">
      <div class="palette-dynamics-meta">
        <span>post-hoc popularity × decayed exposure</span>
        <span>${Number(snapshot.model.exposure_half_life_days)}d half-life</span>
        <span>${catalogEntries} catalog entry / ${releases} release</span>
        <span>${promotions} verified promotion signal${promotions === 1 ? "" : "s"}</span>
        <span>${setlistEvents} setlist event${setlistEvents === 1 ? "" : "s"} / ${setlistSongs} song play${setlistSongs === 1 ? "" : "s"}</span>
        <span>${catalog.analyzed_song_count ?? 0}/${catalog.eligible_song_count ?? 0} songs analyzed</span>
        ${coverage}
        ${promotionCoverage}
      </div>
      <details class="palette-detail">
        <summary>Top song contributions</summary>
        ${topSongs}
      </details>
    </div>`;
}

function ensureDraft() {
  if (!state.draft) {
    const tier = currentTier();
    state.draft = {
      tiers: { ...(tier?.tiers || {}) },
      tier_scores: { ...(tier?.tier_scores || {}) },
      team_palette: { ...(tier?.team_palette || currentPalette()?.palette || {}) },
      members: {},
    };
  }
}

function renderGroup() {
  const tier = currentTier();
  const el = document.getElementById("groupTiers");
  if (!tier) {
    el.innerHTML = `<p class="muted">No tier snapshot for this group/month.</p>`;
  } else {
    const dims = [
      ["live", "Live"],
      ["music", "Music"],
      ["brand", "Brand"],
      ["overall", "Overall"],
    ];
    const cells = dims
      .map(([key, label]) => {
        const letter = tier.tiers?.[key] ?? "—";
        const score = tier.tier_scores?.[`${key}_score`] ?? "—";
        if (state.mode === "edit") {
          return `<div class="tier-cell">
            <div class="k">${label}${tier.manual_override ? ' <span class="badge">manual</span>' : ""}</div>
            <input data-tier-letter="${key}" value="${letter}" />
            <input data-tier-score="${key}" type="number" value="${score}" />
          </div>`;
        }
        return `<div class="tier-cell">
          <div class="k">${label}${tier.manual_override ? ' <span class="badge">manual</span>' : ""}</div>
          <div class="v">${letter}</div>
          <div class="s">${score}</div>
        </div>`;
      })
      .join("");
    const live = tier.live_12m || {};
    const modeledBaseline = Number(live.baseline_ticket_gross_jpy || 0);
    const observedGross = live.ticket_gross_jpy;
    const coverageNote = modeledBaseline > 0
      ? `<p class="muted tier-provenance">Live 12m: observed ticket proxy ${observedGross == null ? "not covered" : `¥${Number(observedGross).toLocaleString()}`} + modeled routine-exposure baseline ¥${modeledBaseline.toLocaleString()} across ${live.baseline_missing_month_count ?? 0} uncovered month(s). The baseline is not a recorded show.</p>`
      : "";
    const policy = currentMembers()?.group_policy;
    const policyNote = policy
      ? `<p class="muted tier-provenance">Group policy: ${escapeHtml(policy.roster_operating_mode || policy.policy_uid)} · ${escapeHtml(policy.planning_horizon || "long-lived")} · ${policy.state_transition === "carry" ? "continued" : "dated policy seed/change"}. Uncalibrated policy is shown for audit only.</p>`
      : "";
    el.innerHTML = `${cells}${coverageNote}${policyNote}`;
    if (state.mode === "edit") {
      el.querySelectorAll("input[data-tier-letter]").forEach((input) => {
        input.addEventListener("change", () => {
          ensureDraft();
          state.draft.tiers[input.getAttribute("data-tier-letter")] = input.value;
          state.dirty = true;
          updateModeChrome();
        });
      });
      el.querySelectorAll("input[data-tier-score]").forEach((input) => {
        input.addEventListener("change", () => {
          ensureDraft();
          const key = input.getAttribute("data-tier-score");
          state.draft.tier_scores[`${key}_score`] = Number(input.value);
          state.dirty = true;
          updateModeChrome();
        });
      });
    }
  }

  renderPalette(document.getElementById("groupPalette"), tier?.team_palette || currentPalette()?.palette, {
    editable: true,
    manual: Boolean(tier?.manual_override || currentPalette()?.manual_override),
    snapshot: currentPalette(),
  });
}

function renderWorld() {
  const world = state.worldPalette.get(state.month);
  const aggregation = world?.aggregation || {};
  const coverage = document.getElementById("worldCoverage");
  coverage.textContent = world?.present
    ? `${aggregation.contributing_group_count ?? 0}/${aggregation.registered_group_count ?? 0} registered simulated group(s) contribute this month. Population coverage is ${aggregation.population_coverage ?? "unknown"}; adding independently replayed groups improves sample coverage without changing group results.`
    : "No completed group Team Palette is available for this month; world aggregate is empty.";
  renderPalette(document.getElementById("worldPalette"), world?.present ? world.palette : null, {
    empty: "No simulated groups this month (world palette empty).",
    manual: Boolean(world?.manual_override),
  });

  const rank = state.rankByMonth.get(state.month);
  const body = document.getElementById("rankBody");
  const empty = document.getElementById("rankEmpty");
  const entries = rank?.entries || [];
  if (!entries.length) {
    body.innerHTML = "";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    body.innerHTML = entries
      .map(
        (e) => `<tr data-slug="${e.slug}" class="${e.slug === state.groupSlug ? "is-on" : ""}">
        <td>${e.rank}</td>
        <td>${e.name}${e.manual_override ? ' <span class="badge">manual</span>' : ""}</td>
        <td>${e.tiers?.overall ?? "—"}</td>
        <td>${e.tiers?.live ?? "—"}</td>
        <td>${e.tiers?.music ?? "—"}</td>
        <td>${e.tiers?.brand ?? "—"}</td>
        <td>${e.tier_scores?.overall_score ?? "—"}</td>
      </tr>`
      )
      .join("");
    body.querySelectorAll("tr[data-slug]").forEach((tr) => {
      tr.addEventListener("click", () => {
        state.groupSlug = tr.getAttribute("data-slug");
        document.getElementById("groupSelect").value = state.groupSlug;
        state.tab = "group";
        state.draft = null;
        render();
      });
    });
  }
}

function monthEndDate(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function monthStartDate(ym) {
  return `${ym}-01`;
}

/** Active on the selected month (inclusive). Future leave dates do not create events. */
function isActiveInMonth(membership, ym) {
  if (!membership?.start) return false;
  const start = membership.start;
  const end = membership.end;
  const ms = monthStartDate(ym);
  const me = monthEndDate(ym);
  if (start > me) return false;
  if (end && end < ms) return false;
  return true;
}

function rolesActiveInMonth(roles, ym) {
  const ms = monthStartDate(ym);
  const me = monthEndDate(ym);
  return (roles || []).filter((r) => {
    if (r.start && r.start > me) return false;
    if (r.end && r.end < ms) return false;
    return true;
  });
}

function renderIdol() {
  const row = currentMembers();
  const list = document.getElementById("memberList");
  const detail = document.getElementById("memberDetail");
  const countEl = document.getElementById("rosterCount");
  if (!row?.members?.length) {
    if (countEl) countEl.textContent = "";
    list.innerHTML = `<p class="muted">No member-state for this group/month.</p>`;
    detail.className = "member-detail muted";
    detail.textContent = "Select an idol.";
    return;
  }

  const active = row.members.filter((m) => isActiveInMonth(m.membership, state.month));
  if (countEl) countEl.textContent = `(${active.length})`;

  if (!active.length) {
    list.innerHTML = `<p class="muted">No active members in ${state.month}.</p>`;
    detail.className = "member-detail muted";
    detail.textContent = "Select an idol.";
    return;
  }

  if (!state.memberUid || !active.some((m) => m.member_uid === state.memberUid)) {
    state.memberUid = active[0].member_uid;
  }

  list.innerHTML = active
    .map((m) => {
      const roles = rolesActiveInMonth(m.active_roles, state.month)
        .map((r) => r.team_role || r.role)
        .filter(Boolean);
      const color = m.assigned_member_color?.hex || "#ddd";
      const sub = [m.member_archetype, roles.join(" · ")].filter(Boolean).join(" · ") || "member";
      return `<button type="button" class="member-btn ${m.member_uid === state.memberUid ? "is-on" : ""}" data-uid="${m.member_uid}">
        <span class="swatch" style="background:${color}"></span>
        <span class="meta">
          <span>${escapeHtml(m.name || m.member_uid)}${m.manual_override ? ' <span class="badge">manual</span>' : ""}</span>
          <span class="sub">${escapeHtml(sub)}</span>
        </span>
      </button>`;
    })
    .join("");

  list.querySelectorAll("button[data-uid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.memberUid = btn.getAttribute("data-uid");
      render();
    });
  });

  const member = active.find((m) => m.member_uid === state.memberUid);
  detail.className = "member-detail";
  detail.innerHTML = renderIdolDetail(member);
  const palHost = detail.querySelector("[data-idol-palette]");
  if (palHost) {
    renderPalette(palHost, member.developed_palette, {
      empty: "Developed palette not in export yet. Showing assigned member color only above.",
    });
  }
}

function renderIdolDetail(member) {
  if (!member) return `<p class="muted">Select an idol.</p>`;
  const roles = rolesActiveInMonth(member.active_roles, state.month);
  const roleHtml = roles.length
    ? roles
        .map((r) => {
          const bits = [r.team_role || r.role];
          if (r.singing_lead_weight != null) bits.push(`singing lead ${r.singing_lead_weight}`);
          if (r.state_transition) bits.push(r.state_transition === "carry" ? "continued" : "dated appointment");
          // As-of month: do not surface future end dates as events.
          return `<span class="role-chip">${escapeHtml(bits.filter(Boolean).join(" · "))}</span>`;
        })
        .join("")
    : `<span class="muted">No active role tags</span>`;

  const tags = (member.entry_tags || []).length
    ? member.entry_tags.map((t) => `<span class="role-chip">${escapeHtml(String(t))}</span>`).join("")
    : member.member_archetype
      ? `<span class="role-chip">${escapeHtml(member.member_archetype)}</span>`
      : `<span class="muted">—</span>`;

  const status = member.status || member.initial_status_at_join || {};
  const attrs = member.attributes && typeof member.attributes === "object" ? member.attributes : null;
  const currentAttrs = attrs?.current && typeof attrs.current === "object" ? attrs.current : null;
  const ceilingAttrs = attrs?.ceiling && typeof attrs.ceiling === "object" ? attrs.ceiling : null;
  const attributeExp = member.attribute_exp && typeof member.attribute_exp === "object" ? member.attribute_exp : null;
  const currentExp = attributeExp?.current && typeof attributeExp.current === "object" ? attributeExp.current : null;
  const attrRows = currentAttrs
    ? Object.entries(currentAttrs)
        .flatMap(([category, values]) => Object.entries(values || {}).map(([key, value]) => {
          const ceiling = ceilingAttrs?.[category]?.[key];
          const exp = currentExp?.[category]?.[key];
          return `<tr><th>${escapeHtml(`${category}.${key}`)}</th><td>${escapeHtml(String(value))}</td><td>${ceiling ?? "—"}</td><td>${exp ?? "—"}</td></tr>`;
        }))
        .join("")
    : attrs
      ? Object.entries(attrs)
          .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
          .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td colspan="3">${escapeHtml(String(value))}</td></tr>`)
          .join("")
      : "";
  const radar = attrs?.radar_values || {};
  const radarText = Object.entries(radar).map(([key, value]) => `${key} ${value}`).join(" · ");

  const color = member.assigned_member_color;
  const joined = member.membership?.start || "—";

  return `
    <h3 style="margin:0 0 0.75rem">${escapeHtml(member.name || "")}</h3>
    <div class="detail-grid">
      <div class="detail-item"><div class="k">Joined</div><div class="v">${escapeHtml(joined)}</div></div>
      <div class="detail-item"><div class="k">Cohort</div><div class="v">${escapeHtml(member.cohort || "—")}</div></div>
      <div class="detail-item"><div class="k">Age</div><div class="v">${member.age ?? "—"}</div></div>
      <div class="detail-item"><div class="k">Tenure (months)</div><div class="v">${member.akishibu_tenure_months ?? "—"}</div></div>
      <div class="detail-item"><div class="k">Prior idol experience</div><div class="v">${escapeHtml(member.prior_idol_experience || "—")}</div></div>
      <div class="detail-item"><div class="k">Effective experience</div><div class="v">${member.experience?.total_effective_months ?? "—"} months</div></div>
      <div class="detail-item"><div class="k">Assigned color</div><div class="v" style="display:flex;gap:0.4rem;align-items:center"><span class="swatch" style="background:${color?.hex || "#ddd"}"></span>${escapeHtml(color?.name || "—")}</div></div>
      <div class="detail-item"><div class="k">Status (month end)</div><div class="v">C ${status.condition ?? "—"} · M ${status.morale ?? "—"} · Conf ${status.confidence ?? "—"}</div></div>
    </div>
    <h4 style="margin:1rem 0 0.4rem">Roles (as of ${escapeHtml(state.month)})</h4>
    <div>${roleHtml}</div>
    <h4 style="margin:1rem 0 0.4rem">Tags / archetype</h4>
    <div>${tags}</div>
    <h4 style="margin:1rem 0 0.4rem">Attributes</h4>
    ${attrs?.ability != null ? `<p><strong>Ability ${attrs.ability}</strong> · overall ${attrs.overall_rating ?? "—"}${radarText ? ` · ${escapeHtml(radarText)}` : ""}</p>` : ""}
    ${
      attrRows
        ? `<table class="attr-table"><thead><tr><th>Attribute</th><th>Current</th><th>Ceiling</th><th>EXP</th></tr></thead><tbody>${attrRows}</tbody></table>`
        : `<p class="muted">Attributes not in this month’s export yet.</p>`
    }
    ${attributeExp ? `<p class="muted">This month: +${attributeExp.month_gain_total ?? 0} AttrEXP · ${escapeHtml((attributeExp.applied_large_live_fact_ids || []).join(", ") || "no verified large live")}</p>` : ""}
    <h4 style="margin:1rem 0 0.4rem">Palette</h4>
    <div data-idol-palette class="palette-block"></div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function updateModeChrome() {
  const label = document.getElementById("modeLabel");
  const saveBtn = document.getElementById("saveBtn");
  const editBtn = document.getElementById("editBtn");
  const authStatus = document.getElementById("authStatus");
  if (state.mode === "edit") {
    label.textContent = "Edit mode";
    label.classList.add("edit");
    editBtn.textContent = "Exit edit";
    saveBtn.disabled = !state.dirty || !state.auth.can_edit;
  } else {
    label.textContent = "Read-only";
    label.classList.remove("edit");
    editBtn.textContent = "Enter edit";
    saveBtn.disabled = true;
    state.draft = null;
    state.dirty = false;
  }
  authStatus.textContent = state.auth.login
    ? `${state.auth.login}${state.auth.can_edit ? " (editor)" : " (no edit ACL)"}`
    : AUTH_API
      ? "Not signed in"
      : "Auth API not configured";
}

function render() {
  writeHash();
  document.getElementById("panelGroup").classList.toggle("hidden", state.tab !== "group");
  document.getElementById("panelWorld").classList.toggle("hidden", state.tab !== "world");
  document.getElementById("panelIdol").classList.toggle("hidden", state.tab !== "idol");
  document.getElementById("groupField").classList.toggle("hidden", state.tab === "world");
  document.querySelectorAll(".tab").forEach((btn) => {
    const on = btn.getAttribute("data-tab") === state.tab;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.getElementById("monthInput").value = state.month;
  document.getElementById("groupSelect").value = state.groupSlug;
  const flags = state.monthsIndex?.months?.[state.month];
  const gflags = flags?.groups?.[state.groupSlug];
  const world = state.worldPalette.get(state.month);
  document.getElementById("statusLine").textContent = state.tab === "world"
    ? `${state.month} · World aggregate · ${world?.aggregation?.contributing_group_count ?? 0} contributing group(s)`
    : `${state.month} · ${state.groupSlug}` +
      (gflags
        ? ` · tiers:${gflags.tiers ? "yes" : "no"} palette:${gflags.team_palette ? "yes" : "no"} members:${gflags.members ? "yes" : "no"}`
        : " · empty month");
  updateModeChrome();
  if (state.tab === "group") renderGroup();
  else if (state.tab === "world") renderWorld();
  else renderIdol();
}

async function refreshAuth() {
  if (!AUTH_API) {
    state.auth = { login: null, can_edit: false };
    return;
  }
  try {
    const res = await fetch(`${AUTH_API.replace(/\/$/, "")}/auth/me`, { credentials: "include" });
    if (!res.ok) throw new Error("me failed");
    state.auth = await res.json();
  } catch {
    state.auth = { login: null, can_edit: false };
  }
}

async function enterEdit() {
  if (state.mode === "edit") {
    state.mode = "view";
    render();
    return;
  }
  if (!AUTH_API) {
    alert("Set Worker auth API URL (localStorage worldSimAuthApi or ?auth=) before editing.");
    return;
  }
  await refreshAuth();
  if (!state.auth.login) {
    location.href = `${AUTH_API.replace(/\/$/, "")}/auth/login?return_to=${encodeURIComponent(location.href)}`;
    return;
  }
  if (!state.auth.can_edit) {
    alert(`GitHub user ${state.auth.login} is not on the edit whitelist.`);
    return;
  }
  state.mode = "edit";
  ensureDraft();
  render();
}

async function saveRevision() {
  if (!AUTH_API || !state.auth.can_edit || !state.draft) return;
  const group = state.manifest.groups.find((g) => g.slug === state.groupSlug);
  const body = {
    month: state.month,
    note: "",
    base_manifest_generated_at: state.manifest.generated_at,
    patches: {
      group_monthly: [
        {
          group_uid: group.group_uid,
          month: state.month,
          set: {
            tiers: state.draft.tiers,
            tier_scores: state.draft.tier_scores,
            team_palette: state.draft.team_palette,
          },
        },
      ],
      member_monthly: Object.entries(state.draft.members || {}).map(([member_uid, set]) => ({
        member_uid,
        month: state.month,
        set,
      })),
      world_monthly: [],
    },
  };
  const res = await fetch(`${AUTH_API.replace(/\/$/, "")}/api/revisions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    alert(`Save failed: ${res.status} ${text}`);
    return;
  }
  const saved = await res.json();
  alert(`Saved revision ${saved.revision_id || saved.file || ""} at ${saved.saved_at || ""}`);
  state.dirty = false;
  state.mode = "view";
  await loadAll();
  render();
}

function bindUi() {
  document.getElementById("monthInput").addEventListener("change", (e) => {
    state.month = e.target.value;
    state.draft = null;
    state.dirty = false;
    render();
  });
  document.getElementById("groupSelect").addEventListener("change", (e) => {
    state.groupSlug = e.target.value;
    state.memberUid = null;
    state.draft = null;
    state.dirty = false;
    render();
  });
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.getAttribute("data-tab");
      render();
    });
  });
  document.getElementById("editBtn").addEventListener("click", () => enterEdit());
  document.getElementById("saveBtn").addEventListener("click", () => saveRevision());
  window.addEventListener("hashchange", () => {
    const h = parseHash();
    if (h.month) state.month = h.month;
    if (h.group) state.groupSlug = h.group;
    state.tab = h.tab;
    state.mode = h.mode === "edit" && state.auth.can_edit ? "edit" : "view";
    state.memberUid = h.idol;
    render();
  });
}

async function boot() {
  bindUi();
  await loadAll();
  const h = parseHash();
  const select = document.getElementById("groupSelect");
  select.innerHTML = state.manifest.groups
    .map((g) => `<option value="${g.slug}">${g.name}</option>`)
    .join("");
  document.getElementById("monthInput").min = state.manifest.month_start;
  document.getElementById("monthInput").max = state.manifest.month_end;
  state.month = h.month || "2022-11";
  if (state.month < state.manifest.month_start) state.month = state.manifest.month_start;
  if (state.month > state.manifest.month_end) state.month = state.manifest.month_end;
  state.groupSlug = h.group || state.manifest.groups[0]?.slug || "akishibu";
  state.tab = h.tab;
  state.memberUid = h.idol;
  await refreshAuth();
  state.mode = h.mode === "edit" && state.auth.can_edit ? "edit" : "view";
  document.getElementById("statusLine").textContent = `Loaded ${state.manifest.groups.length} group(s); months ${state.manifest.month_start}…${state.manifest.month_end}`;
  render();
}

boot().catch((err) => {
  document.getElementById("statusLine").textContent = String(err);
  console.error(err);
});
