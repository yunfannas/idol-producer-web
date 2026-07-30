/**
 * Images under `public/` resolved via `new URL(path, document.baseURI)`.
 *
 * **Idol portraits:** JSON may still use long desktop paths (`fetcher/.../picture_fandom/…`).
 * The browser always loads **`data/pictures/idols/<basename>`** — copy each file into
 * `public/data/pictures/idols/` using the **same filename** as the last segment of `portrait_photo_path`.
 * Optional `x_profile_image_url` when there is no local path field.
 *
 * **Group / cover art:** (deferred vs. CD history) desktop `picture/…` still maps to
 * `public/data/pictures/groups/` via `groupPicturePublicSrc` when you wire that UI.
 *
 * UTF-8 path segments are preserved (no per-segment `encodeURIComponent` on slashes).
 * When a portrait file is missing, `wirePortraitFallbacks` swaps to an inline SVG placeholder.
 */

function normalizePublicRelPath(norm: string): string {
  return norm
    .replace(/^\.\//, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

/** Build absolute URL for a path under `public/` (relative to current document). */
export function resolvePublicAssetUrl(relPath: string): string {
  if (typeof document !== "undefined" && document.baseURI) {
    try {
      return new URL(relPath, document.baseURI).href;
    } catch {
      /* fall through */
    }
  }
  const b = import.meta.env.BASE_URL || "/";
  if (b === "./" || b === ".") return `./${relPath}`;
  const prefix = b.endsWith("/") ? b : `${b}/`;
  return `${prefix}${relPath}`;
}

/**
 * Idol portrait files are stored flat under `public/data/pictures/idols/`.
 * Ignore any legacy directory prefix in JSON — only the filename must match on disk.
 */
function mapPortraitRelToWebStorage(rel: string): string {
  const n = normalizePublicRelPath(rel);
  if (!n) return rel;
  if (n.startsWith("data/pictures/idols/")) return n;
  const base = n.split("/").pop() ?? "";
  if (!base || base === "." || base === "..") return n;
  return `data/pictures/idols/${base}`;
}

type GroupPortraitHistoryEntry = {
  path?: unknown;
  portrait_photo_path?: unknown;
  timestamp?: unknown;
  effective_date?: unknown;
  release_date?: unknown;
};

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function portraitHistoryDateValue(entry: GroupPortraitHistoryEntry): string {
  return (
    asTrimmedString(entry.timestamp) ??
    asTrimmedString(entry.effective_date) ??
    asTrimmedString(entry.release_date) ??
    ""
  );
}

function portraitHistoryPath(entry: GroupPortraitHistoryEntry): string | undefined {
  return asTrimmedString(entry.path) ?? asTrimmedString(entry.portrait_photo_path);
}

function normalizeAsOfDay(asOfIso: string | null | undefined): string | null {
  if (!asOfIso) return null;
  const day = String(asOfIso).trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Newest portrait path in one group's history, optionally capped at `asOfDay` (inclusive). */
function latestPortraitHistoryPath(history: unknown, asOfDay: string | null = null): string | undefined {
  if (!Array.isArray(history)) return undefined;
  const entries = history
    .filter((entry): entry is GroupPortraitHistoryEntry => typeof entry === "object" && entry !== null)
    .map((entry) => ({ entry, path: portraitHistoryPath(entry), date: portraitHistoryDateValue(entry) }))
    .filter((item) => item.path)
    .filter((item) => {
      if (!asOfDay) return true;
      if (!item.date) return true; // undated = available from the start
      return item.date <= asOfDay;
    });
  if (!entries.length) return undefined;
  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp) return dateCmp;
    return String(b.path).localeCompare(String(a.path));
  });
  return entries[0]?.path;
}

/**
 * Map desktop `picture/…` (group photos, logos, single covers) to `data/pictures/groups/<basename>`.
 * Absolute `http(s)` URLs are returned unchanged.
 */
export function groupPicturePublicSrc(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const norm = normalizePublicRelPath(raw.replace(/\\/g, "/").trim());
  if (!norm) return undefined;
  if (/^https?:\/\//i.test(norm)) return norm;
  if (norm.startsWith("data/pictures/groups/")) return resolvePublicAssetUrl(norm);
  if (norm.startsWith("picture/")) {
    const base = norm.split("/").pop() ?? "";
    if (!base) return undefined;
    return resolvePublicAssetUrl(`data/pictures/groups/${base}`);
  }
  return resolvePublicAssetUrl(norm);
}

/** Safe for double-quoted HTML attributes. */
export function attrQuotedUrl(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Minimal XML text escape for one display character inside generated SVG. */
function xmlTextChar(ch: string): string {
  return ch.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Letter-style placeholder when `public/...` portrait files are not deployed. */
export function avatarPlaceholderDataUrl(displayName: string): string {
  const ch = xmlTextChar([...(displayName.trim() || "?")][0] ?? "?");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="#16213e" width="128" height="128"/><text x="64" y="78" text-anchor="middle" fill="#a0a0a0" font-size="52" font-family="Segoe UI,system-ui,sans-serif">${ch}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Resolve idol portrait for web display.
 * When `asOfIso` is set, prefer the newest `group_portrait_history` entry whose
 * effective date is on/before that day (Scenario 6 opening keeps pre-transfer looks).
 */
export function idolPortraitPublicSrc(
  row: Record<string, unknown>,
  asOfIso?: string | null,
): string | undefined {
  const asOfDay = normalizeAsOfDay(asOfIso);
  const portraitHistory = row.group_portrait_history;
  if (portraitHistory && typeof portraitHistory === "object") {
    const candidates = Object.values(portraitHistory as Record<string, unknown>)
      .map((history) => {
        const path = latestPortraitHistoryPath(history, asOfDay);
        if (!path) return null;
        const hist = Array.isArray(history) ? history : [];
        const match = hist.find((e) => e && portraitHistoryPath(e as GroupPortraitHistoryEntry) === path) as
          | GroupPortraitHistoryEntry
          | undefined;
        return { path, date: match ? portraitHistoryDateValue(match) : "" };
      })
      .filter((x): x is { path: string; date: string } => Boolean(x?.path));
    candidates.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp) return dateCmp;
      return a.path.localeCompare(b.path);
    });
    const latest = candidates[0]?.path;
    if (latest) {
      const rel = mapPortraitRelToWebStorage(latest);
      if (rel) return resolvePublicAssetUrl(rel);
    }
  }

  const rawPath = row.portrait_photo_path;
  if (typeof rawPath === "string") {
    const norm = rawPath.replace(/\\/g, "/").trim();
    if (norm) {
      if (/^https?:\/\//i.test(norm)) return norm;
      const rel = mapPortraitRelToWebStorage(norm);
      if (rel) return resolvePublicAssetUrl(rel);
    }
  }

  const http = row.x_profile_image_url;
  if (typeof http === "string") {
    const u = http.trim();
    if (/^https?:\/\//i.test(u)) return u;
  }

  return undefined;
}

/** After shell paint: swap broken portrait URLs to `data-fallback` (SVG initial). */
export function wirePortraitFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("img.idol-detail-portrait, img.idol-thumb, img.group-detail-hero, img.group-detail-logo").forEach((img) => {
    const fb = img.dataset.fallback;
    if (!fb) return;
    img.addEventListener(
      "error",
      () => {
        // Corner logos must not fall back to a letter tile — that overlaps the hero.
        if (img.classList.contains("group-detail-logo")) {
          img.remove();
          return;
        }
        if (img.src !== fb) {
          img.src = fb;
          delete img.dataset.fallback;
        }
      },
      { once: true },
    );
  });
}
