/**
 * 30s song previews (Apple Music / Spotify preview URLs).
 *
 * Preferred song row fields:
 *   apple_music_url, apple_preview_url, spotify_url, spotify_preview_url
 * Fallback: iTunes Lookup from `_apple_track_ids` when preview URLs missing.
 *
 * Apple CDN often returns M4A bytes with Content-Type: application/json, which
 * HTMLAudioElement rejects — we materialize those as audio/mp4 blobs.
 * Playback with a known URL must call audio.play() in the same user-gesture turn
 * (no await before play).
 *
 * Default envelope: 2s fade-in 0→100% and 2s fade-out (stop / pause / end of clip).
 */

import { htmlEsc } from "./htmlEsc";

export type SongPreviewAction = "play" | "pause" | "stop";

export type SongPreviewState = "idle" | "loading" | "playing" | "paused" | "unavailable";

export type PreviewResolveInput = {
  uid?: string | null;
  previewUrl?: string | null;
  appleTrackId?: string | number | null;
  appleTrackIds?: unknown;
  applePreviewUrl?: string | null;
  spotifyPreviewUrl?: string | null;
};

const previewUrlCache = new Map<string, string | null>();
/** uid / source-url → object URL with corrected MIME */
const objectUrlCache = new Map<string, string>();
const objectUrlInflight = new Map<string, Promise<string | null>>();

/** Default fade envelope for every song preview play. */
export const SONG_PREVIEW_FADE_IN_SEC = 2;
export const SONG_PREVIEW_FADE_OUT_SEC = 2;

let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let activeUid = "";
let activeState: SongPreviewState = "idle";
let resolveToken = 0;
let activeBufferSource: AudioBufferSourceNode | null = null;
let htmlFadeRaf = 0;
let htmlFadeOutTimer = 0;
let htmlAutoFadeArmed = false;
let endedListener: ((uid: string) => void) | null = null;
let playbackStartedAtMs = 0;
let playbackOffsetSec = 0;
let webAudioDurationSec = 0;

/** Register a listener fired when the active preview finishes naturally (not on stop/pause). */
export function setSongPreviewEndedListener(listener: ((uid: string) => void) | null): void {
  endedListener = listener;
}

function notifyPreviewEnded(uid: string): void {
  const fn = endedListener;
  if (!fn || !uid) return;
  try {
    fn(uid);
  } catch {
    /* ignore listener errors */
  }
}

/** Current media clock for progress UI (HTML path preferred; Web Audio falls back to wall clock). */
export function getSongPreviewMediaTime(): { currentTime: number; duration: number; uid: string } | null {
  if (!activeUid || (activeState !== "playing" && activeState !== "paused" && activeState !== "loading")) {
    return null;
  }
  if (audioEl && audioEl.src && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
    return {
      uid: activeUid,
      currentTime: Math.max(0, audioEl.currentTime || 0),
      duration: audioEl.duration,
    };
  }
  if (webAudioDurationSec > 0 && playbackStartedAtMs > 0) {
    const wall = activeState === "paused"
      ? playbackOffsetSec
      : playbackOffsetSec + (performance.now() - playbackStartedAtMs) / 1000;
    return {
      uid: activeUid,
      currentTime: Math.max(0, Math.min(webAudioDurationSec, wall)),
      duration: webAudioDurationSec,
    };
  }
  return { uid: activeUid, currentTime: 0, duration: 30 };
}

function cancelHtmlFade(): void {
  if (htmlFadeRaf) {
    cancelAnimationFrame(htmlFadeRaf);
    htmlFadeRaf = 0;
  }
  if (htmlFadeOutTimer) {
    window.clearTimeout(htmlFadeOutTimer);
    htmlFadeOutTimer = 0;
  }
  htmlAutoFadeArmed = false;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Animate HTMLAudioElement.volume with rAF. */
function fadeHtmlVolume(from: number, to: number, durationSec: number, token: number): Promise<void> {
  cancelHtmlFade();
  const audio = ensureAudio();
  const start = performance.now();
  const durationMs = Math.max(0, durationSec * 1000);
  audio.volume = clamp01(from);
  if (durationMs <= 0) {
    audio.volume = clamp01(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const step = (now: number) => {
      if (token !== resolveToken) {
        resolve();
        return;
      }
      const t = clamp01((now - start) / durationMs);
      audio.volume = clamp01(from + (to - from) * t);
      if (t >= 1) {
        htmlFadeRaf = 0;
        resolve();
        return;
      }
      htmlFadeRaf = requestAnimationFrame(step);
    };
    htmlFadeRaf = requestAnimationFrame(step);
  });
}

function ensureMasterGain(): GainNode {
  const ctx = ensureAudioContext();
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

function fadeContextGain(to: number, durationSec: number): void {
  try {
    const ctx = ensureAudioContext();
    const gain = ensureMasterGain();
    const now = ctx.currentTime;
    const cur = gain.gain.value;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(cur, now);
    gain.gain.linearRampToValueAtTime(clamp01(to), now + Math.max(0.01, durationSec));
  } catch {
    /* ignore */
  }
}

function armHtmlAutoFadeOut(token: number): void {
  const audio = ensureAudio();
  const schedule = () => {
    if (token !== resolveToken || !audio.duration || !Number.isFinite(audio.duration)) return;
    if (htmlAutoFadeArmed) return;
    htmlAutoFadeArmed = true;
    const leadMs = Math.max(0, (audio.duration - SONG_PREVIEW_FADE_OUT_SEC) * 1000 - audio.currentTime * 1000);
    htmlFadeOutTimer = window.setTimeout(() => {
      if (token !== resolveToken || activeState !== "playing") return;
      void fadeHtmlVolume(audio.volume, 0, SONG_PREVIEW_FADE_OUT_SEC, token);
    }, leadMs);
  };
  if (audio.readyState >= 1) schedule();
  else audio.addEventListener("loadedmetadata", schedule, { once: true });
}

function ensureAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx!();
  }
  return audioCtx;
}

/** Call during pointerdown/click so later async decode/play is allowed. */
export function unlockSongPreviewAudio(): void {
  try {
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
  ensureAudio();
}

async function playViaAudioContext(arrayBuffer: ArrayBuffer, token: number): Promise<boolean> {
  const ctx = ensureAudioContext();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (token !== resolveToken) return false;
  try {
    const copy = arrayBuffer.slice(0);
    const decoded = await ctx.decodeAudioData(copy);
    if (token !== resolveToken) return false;
    if (activeBufferSource) {
      try {
        activeBufferSource.stop();
      } catch {
        /* ignore */
      }
      activeBufferSource = null;
    }
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
    }
    const gain = ensureMasterGain();
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + SONG_PREVIEW_FADE_IN_SEC);

    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(gain);
    const dur = decoded.duration;
    if (dur > SONG_PREVIEW_FADE_OUT_SEC) {
      const fadeAt = now + dur - SONG_PREVIEW_FADE_OUT_SEC;
      gain.gain.setValueAtTime(1, fadeAt);
      gain.gain.linearRampToValueAtTime(0, fadeAt + SONG_PREVIEW_FADE_OUT_SEC);
    }
    src.onended = () => {
      if (activeBufferSource === src) {
        const endedUid = activeUid;
        activeBufferSource = null;
        activeState = "idle";
        playbackStartedAtMs = 0;
        playbackOffsetSec = 0;
        webAudioDurationSec = 0;
        syncSongPreviewUi(document);
        notifyPreviewEnded(endedUid);
      }
    };
    activeBufferSource = src;
    webAudioDurationSec = dur;
    playbackOffsetSec = 0;
    playbackStartedAtMs = performance.now();
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

function firstAppleTrackId(input: PreviewResolveInput): string {
  const direct = input.appleTrackId;
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const ids = input.appleTrackIds;
  if (Array.isArray(ids)) {
    for (const id of ids) {
      const s = String(id ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

function cacheKey(input: PreviewResolveInput): string {
  const uid = String(input.uid ?? "").trim();
  if (uid) return `uid:${uid}`;
  const apple = firstAppleTrackId(input);
  if (apple) return `apple:${apple}`;
  const spotify = String(input.spotifyPreviewUrl ?? "").trim();
  if (spotify) return `spotify:${spotify}`;
  const preview = String(input.previewUrl ?? "").trim();
  if (preview) return `url:${preview}`;
  return "";
}

/** Ordered candidate preview URLs (Spotify MP3 first — broader browser support). */
export function previewUrlCandidates(input: PreviewResolveInput): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (s && !out.includes(s)) out.push(s);
  };
  push(input.spotifyPreviewUrl);
  push(input.applePreviewUrl);
  push(input.previewUrl);
  return out;
}

function needsBlobMaterialize(url: string): boolean {
  return /itunes\.apple\.com|audio-ssl\.itunes|mzstatic\.com|\.m4a(?:$|\?)/i.test(url);
}

function sniffAudioMime(bytes: Uint8Array, fallbackUrl: string): string {
  if (bytes.length >= 12) {
    // ....ftyp????
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return "audio/mp4";
    }
    // ID3
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "audio/mpeg";
    // MPEG frame sync
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  }
  if (needsBlobMaterialize(fallbackUrl)) return "audio/mp4";
  return "audio/mpeg";
}

export async function materializePreviewObjectUrl(sourceUrl: string): Promise<string | null> {
  const key = sourceUrl;
  const hit = objectUrlCache.get(key);
  if (hit) return hit;
  const inflight = objectUrlInflight.get(key);
  if (inflight) return inflight;

  const job = (async () => {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (!bytes.length) return null;
      const mime = sniffAudioMime(bytes, sourceUrl);
      const objectUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
      objectUrlCache.set(key, objectUrl);
      return objectUrl;
    } catch {
      return null;
    } finally {
      objectUrlInflight.delete(key);
    }
  })();
  objectUrlInflight.set(key, job);
  return job;
}

/** Warm object-URL cache for preview controls currently in the DOM. */
export function prefetchSongPreviewsInRoot(root: ParentNode = document): void {
  const controls = root.querySelectorAll<HTMLElement>(".song-preview-controls");
  for (const el of controls) {
    const input = previewInputFromControlsEl(el);
    for (const url of previewUrlCandidates(input)) {
      if (needsBlobMaterialize(url) || !objectUrlCache.has(url)) {
        void materializePreviewObjectUrl(url);
      }
    }
  }
}

/** Pull preview-related fields from a songs.json row. */
export function previewInputFromSongRow(row: Record<string, unknown> | null | undefined): PreviewResolveInput {
  if (!row) return {};
  return {
    uid: String(row.uid ?? "").trim() || null,
    previewUrl: typeof row.preview_url === "string" ? row.preview_url : null,
    applePreviewUrl: typeof row.apple_preview_url === "string" ? row.apple_preview_url : null,
    appleTrackIds: row._apple_track_ids,
    appleTrackId: Array.isArray(row._apple_track_ids) ? row._apple_track_ids[0] : null,
    spotifyPreviewUrl: typeof row.spotify_preview_url === "string" ? row.spotify_preview_url : null,
  };
}

/** Merge DOM attrs + catalog row so stale snapshots still play. */
export function mergePreviewInput(
  base: PreviewResolveInput,
  row: Record<string, unknown> | null | undefined,
): PreviewResolveInput {
  const fromRow = previewInputFromSongRow(row);
  return {
    uid: base.uid || fromRow.uid,
    previewUrl: base.previewUrl || fromRow.previewUrl,
    applePreviewUrl: base.applePreviewUrl || fromRow.applePreviewUrl,
    spotifyPreviewUrl: base.spotifyPreviewUrl || fromRow.spotifyPreviewUrl,
    appleTrackId: base.appleTrackId || fromRow.appleTrackId,
    appleTrackIds: base.appleTrackIds || fromRow.appleTrackIds,
  };
}

export async function resolveSongPreviewUrl(input: PreviewResolveInput): Promise<string | null> {
  const known = previewUrlCandidates(input);
  if (known.length) return known[0]!;

  const key = cacheKey(input);
  if (key && previewUrlCache.has(key)) return previewUrlCache.get(key) ?? null;

  const appleId = firstAppleTrackId(input);
  if (!appleId) {
    if (key) previewUrlCache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(appleId)}&country=jp`);
    if (!res.ok) {
      if (key) previewUrlCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as { results?: Array<{ previewUrl?: string }> };
    const url = String(data.results?.[0]?.previewUrl ?? "").trim() || null;
    if (key) previewUrlCache.set(key, url);
    return url;
  } catch {
    if (key) previewUrlCache.set(key, null);
    return null;
  }
}

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.preload = "auto";
  audioEl.volume = 0;
  audioEl.addEventListener("ended", () => {
    cancelHtmlFade();
    const endedUid = activeUid;
    activeState = "idle";
    playbackStartedAtMs = 0;
    playbackOffsetSec = 0;
    syncSongPreviewUi(document);
    notifyPreviewEnded(endedUid);
  });
  audioEl.addEventListener("pause", () => {
    if (activeState === "playing" && audioEl && !audioEl.ended) {
      if (playbackStartedAtMs > 0) {
        playbackOffsetSec += (performance.now() - playbackStartedAtMs) / 1000;
        playbackStartedAtMs = 0;
      }
      activeState = "paused";
      syncSongPreviewUi(document);
    }
  });
  audioEl.addEventListener("play", () => {
    playbackStartedAtMs = performance.now();
    activeState = "playing";
    syncSongPreviewUi(document);
  });
  audioEl.addEventListener("error", () => {
    if (activeUid && activeState !== "idle") {
      activeState = "unavailable";
      syncSongPreviewUi(document);
    }
  });
  return audioEl;
}

function bindAudioSrc(url: string): void {
  const audio = ensureAudio();
  audio.src = url;
}

async function startHtmlPlaybackWithFade(token: number): Promise<boolean> {
  const audio = ensureAudio();
  audio.volume = 0;
  try {
    const p = audio.play();
    activeState = "playing";
    syncSongPreviewUi(document);
    await p;
    if (token !== resolveToken) return false;
    void fadeHtmlVolume(0, 1, SONG_PREVIEW_FADE_IN_SEC, token);
    armHtmlAutoFadeOut(token);
    return true;
  } catch {
    return false;
  }
}

export function getSongPreviewActiveUid(): string {
  return activeUid;
}

export function getSongPreviewState(): SongPreviewState {
  return activeState;
}

async function fadeOutThenStop(token: number): Promise<void> {
  const audio = ensureAudio();
  if (activeBufferSource && masterGain && audioCtx) {
    fadeContextGain(0, SONG_PREVIEW_FADE_OUT_SEC);
    await new Promise((r) => window.setTimeout(r, SONG_PREVIEW_FADE_OUT_SEC * 1000));
    if (token !== resolveToken) return;
    try {
      activeBufferSource.stop();
    } catch {
      /* ignore */
    }
    activeBufferSource = null;
  } else if (audioEl && !audioEl.paused) {
    await fadeHtmlVolume(audio.volume, 0, SONG_PREVIEW_FADE_OUT_SEC, token);
    if (token !== resolveToken) return;
    audio.pause();
  }
}

export function stopSongPreview(): void {
  const token = ++resolveToken;
  cancelHtmlFade();
  void (async () => {
    await fadeOutThenStop(token);
    if (token !== resolveToken) return;
    if (audioEl) {
      try {
        audioEl.removeAttribute("src");
        audioEl.load();
        audioEl.volume = 0;
      } catch {
        /* ignore */
      }
    }
    activeUid = "";
    activeState = "idle";
    syncSongPreviewUi(document);
  })();
  // Reflect stopping immediately in UI (fade continues in background).
  activeState = "idle";
  syncSongPreviewUi(document);
}

async function fetchPreviewBytes(sourceUrl: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function playSourceUrl(uid: string, sourceUrl: string, token: number): Promise<boolean> {
  ensureAudio();
  // Resume AudioContext during the click turn when possible (helps post-await playback).
  try {
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* AudioContext optional */
  }

  const cachedObject = objectUrlCache.get(sourceUrl);
  if (cachedObject || !needsBlobMaterialize(sourceUrl)) {
    try {
      cancelHtmlFade();
      bindAudioSrc(cachedObject ?? sourceUrl);
      activeUid = uid;
      const ok = await startHtmlPlaybackWithFade(token);
      if (ok) return token === resolveToken;
    } catch {
      /* fall through */
    }
  }

  const bytes = await fetchPreviewBytes(sourceUrl);
  if (!bytes || token !== resolveToken) return false;

  // Cache corrected blob for next click / HTMLAudioElement path.
  const mime = sniffAudioMime(new Uint8Array(bytes), sourceUrl);
  if (!objectUrlCache.has(sourceUrl)) {
    objectUrlCache.set(sourceUrl, URL.createObjectURL(new Blob([bytes], { type: mime })));
  }

  // Prefer Web Audio after async fetch — works after AudioContext.resume() in the gesture.
  if (await playViaAudioContext(bytes, token)) {
    activeUid = uid;
    activeState = "playing";
    syncSongPreviewUi(document);
    return true;
  }

  try {
    cancelHtmlFade();
    bindAudioSrc(objectUrlCache.get(sourceUrl)!);
    activeUid = uid;
    return await startHtmlPlaybackWithFade(token);
  } catch {
    return false;
  }
}

/** Always start (or restart) a preview — does not toggle pause. */
export async function playSongPreview(input: PreviewResolveInput): Promise<SongPreviewState> {
  const uid = String(input.uid ?? "").trim() || cacheKey(input);
  if (!uid) {
    activeState = "unavailable";
    syncSongPreviewUi(document);
    return activeState;
  }
  // Force a fresh start even if the same uid is already active.
  if (activeUid === uid && (activeState === "playing" || activeState === "paused" || activeState === "loading")) {
    activeUid = "";
    activeState = "idle";
  }
  return toggleSongPreview(input);
}

export async function toggleSongPreview(input: PreviewResolveInput): Promise<SongPreviewState> {
  const uid = String(input.uid ?? "").trim() || cacheKey(input);
  if (!uid) {
    activeState = "unavailable";
    syncSongPreviewUi(document);
    return activeState;
  }

  const audio = ensureAudio();
  if (activeUid === uid && activeState === "playing") {
    // Pause = fan-out, then pause.
    const token = ++resolveToken;
    cancelHtmlFade();
    activeState = "paused";
    syncSongPreviewUi(document);
    await fadeOutThenStop(token);
    if (token !== resolveToken) return getSongPreviewState();
    if (audioEl && !audioEl.paused) audioEl.pause();
    activeUid = uid;
    activeState = "paused";
    syncSongPreviewUi(document);
    return activeState;
  }
  if (activeUid === uid && activeState === "paused" && (audio.src || objectUrlCache.size)) {
    try {
      if (!audio.src) {
        /* fall through to fresh play below */
      } else {
        const token = ++resolveToken;
        activeUid = uid;
        const ok = await startHtmlPlaybackWithFade(token);
        if (ok) return getSongPreviewState();
      }
    } catch {
      /* fall through */
    }
  }

  const known = previewUrlCandidates(input);
  const token = ++resolveToken;
  // Hard-stop any previous preview before starting this one (new fade-in applies).
  cancelHtmlFade();
  if (activeBufferSource) {
    try {
      activeBufferSource.stop();
    } catch {
      /* ignore */
    }
    activeBufferSource = null;
  }
  if (audioEl && !audioEl.paused) {
    try {
      audioEl.pause();
    } catch {
      /* ignore */
    }
  }
  try {
    fadeContextGain(0, 0.01);
  } catch {
    /* ignore */
  }
  activeUid = uid;
  activeState = "loading";
  // Do not disable the clicked control before play() — keep gesture valid.
  syncSongPreviewUi(document);

  if (known.length) {
    for (const url of known) {
      if (token !== resolveToken) return getSongPreviewState();
      const ok = await playSourceUrl(uid, url, token);
      if (ok) return getSongPreviewState();
    }
    activeUid = uid;
    activeState = "unavailable";
    syncSongPreviewUi(document);
    return activeState;
  }

  const fetched = await resolveSongPreviewUrl(input);
  if (token !== resolveToken) return getSongPreviewState();
  if (!fetched) {
    activeUid = uid;
    activeState = "unavailable";
    syncSongPreviewUi(document);
    return activeState;
  }
  const ok = await playSourceUrl(uid, fetched, token);
  if (!ok) {
    activeUid = uid;
    activeState = "unavailable";
    syncSongPreviewUi(document);
  }
  return getSongPreviewState();
}

export function songHasPreviewSource(row: Record<string, unknown> | null | undefined): boolean {
  const input = previewInputFromSongRow(row);
  return Boolean(previewUrlCandidates(input).length || firstAppleTrackId(input));
}

/** Markup for play/pause + stop controls on a song row. */
export function renderSongPreviewControls(row: Record<string, unknown>, lang: "en" | "zh-CN" = "en"): string {
  const input = previewInputFromSongRow(row);
  const uid = String(input.uid ?? "").trim();
  const appleId = firstAppleTrackId(input);
  const candidates = previewUrlCandidates(input);
  const hasSource = Boolean(candidates.length || appleId);
  if (!uid || !hasSource) {
    const label = lang === "zh-CN" ? "无试听" : "N/A";
    return `<span class="song-preview-na content-muted" title="${htmlEsc(label)}">${htmlEsc(label)}</span>`;
  }

  const playLabel = lang === "zh-CN" ? "播放/暂停" : "Play / Pause";
  const stopLabel = lang === "zh-CN" ? "停止" : "Stop";
  const primary = candidates[0] ?? "";
  const spotify = String(input.spotifyPreviewUrl ?? "").trim();
  const applePreview = String(input.applePreviewUrl ?? "").trim();

  return `<div class="song-preview-controls" data-wiki-skip data-song-preview-uid="${htmlEsc(uid)}"${
    appleId ? ` data-apple-track-id="${htmlEsc(appleId)}"` : ""
  }${primary ? ` data-preview-url="${htmlEsc(primary)}"` : ""}${
    spotify ? ` data-spotify-preview-url="${htmlEsc(spotify)}"` : ""
  }${applePreview ? ` data-apple-preview-url="${htmlEsc(applePreview)}"` : ""}>
    <button type="button" class="fm-btn fm-btn-xs song-preview-play" data-song-preview-action="play" aria-label="${htmlEsc(playLabel)}" title="${htmlEsc(playLabel)}">▶</button>
    <button type="button" class="fm-btn fm-btn-xs song-preview-stop" data-song-preview-action="stop" aria-label="${htmlEsc(stopLabel)}" title="${htmlEsc(stopLabel)}">■</button>
  </div>`;
}

/** Read preview input from a controls root element. */
export function previewInputFromControlsEl(el: HTMLElement): PreviewResolveInput {
  return {
    uid: el.getAttribute("data-song-preview-uid"),
    appleTrackId: el.getAttribute("data-apple-track-id"),
    previewUrl: el.getAttribute("data-preview-url"),
    spotifyPreviewUrl: el.getAttribute("data-spotify-preview-url"),
    applePreviewUrl: el.getAttribute("data-apple-preview-url"),
  };
}

/** Update play/pause glyphs and active classes after paint or state change. */
export function syncSongPreviewUi(root: ParentNode = document): void {
  const controls = root.querySelectorAll<HTMLElement>(".song-preview-controls[data-song-preview-uid]");
  for (const el of controls) {
    const uid = el.getAttribute("data-song-preview-uid") ?? "";
    const playBtn = el.querySelector<HTMLButtonElement>(".song-preview-play");
    const stopBtn = el.querySelector<HTMLButtonElement>(".song-preview-stop");
    const isActive = Boolean(uid && uid === activeUid);
    el.classList.toggle("is-active", isActive);
    el.classList.toggle("is-loading", isActive && activeState === "loading");
    el.classList.toggle("is-playing", isActive && activeState === "playing");
    el.classList.toggle("is-paused", isActive && activeState === "paused");
    el.classList.toggle("is-unavailable", isActive && activeState === "unavailable");
    if (playBtn) {
      if (isActive && activeState === "loading") {
        playBtn.textContent = "…";
        playBtn.disabled = false; // keep enabled so gesture / retries stay usable
      } else if (isActive && activeState === "playing") {
        playBtn.textContent = "❚❚";
        playBtn.disabled = false;
      } else if (isActive && activeState === "unavailable") {
        playBtn.textContent = "✖";
        playBtn.disabled = false;
      } else {
        playBtn.textContent = "▶";
        playBtn.disabled = false;
      }
    }
    if (stopBtn) {
      stopBtn.disabled = !isActive || activeState === "idle";
    }
  }
}
