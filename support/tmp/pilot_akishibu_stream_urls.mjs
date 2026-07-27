/**
 * Pilot: enrich アキシブproject songs with streaming + preview URL fields.
 *
 * Fields written on matching rows in public/data/songs.json:
 *   apple_music_url, apple_preview_url, spotify_url, spotify_preview_url
 *
 * Apple  -> iTunes Lookup from `_apple_track_ids` (no auth)
 * Spotify -> artist embed top-tracks JSON (no auth); optional Client Credentials
 *            if SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are set (full catalog)
 *
 * Usage:
 *   node support/tmp/pilot_akishibu_stream_urls.mjs
 *   node support/tmp/pilot_akishibu_stream_urls.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const songsPath = path.join(root, "public/data/songs.json");
const GROUP_UID = "44Ki44Kt44K344OWcHJvamVjdA";
const SPOTIFY_ARTIST_ID = "3CxxKxNRwPA17HmV5FejRv";
const dryRun = process.argv.includes("--dry-run");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Extra JP <-> romanized aliases for Spotify's Latin titles. */
const TITLE_ALIASES = {
  アキシブウェイ: ["akishibu way", "aksb way"],
  真夏のセレナーデ: ["manatunoserenade", "manatsu no serenade"],
  小さな決意: ["chisanaketsui", "chiisana ketsui"],
  "Summer☆Summer": ["summer summer"],
  セツナコバルトブルー: ["setsuna cobalt blue"],
  タイムレスメモリー: ["timeless memory"],
  "Eternal Blue ~キミと僕と空と海の物語~": [
    "eternal blue kimito bokuto sorato umi no monogatari",
    "eternal blue",
  ],
  あてんしょん・ぷりーず: ["attention please", "atenshon please"],
  私だけにフォーカスして: ["focus on me", "watashi dake ni focus"],
  新宇宙世紀アイドルちゃん: ["shin uchu seiki idol chan"],
  常夏トロピケーション: ["tokonatsu tropication"],
};

function cleanAppleUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.delete("uo");
    return u.toString();
  } catch {
    return String(url).trim() || null;
  }
}

function normalizeTitle(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, " ")
    .replace(/[~～〜].*$/u, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactTitle(s) {
  return normalizeTitle(s).replace(/\s+/g, "");
}

function titleCandidates(song) {
  const out = [];
  const push = (v) => {
    const s = String(v ?? "").trim();
    if (s) out.push(s);
  };
  push(song.title);
  push(song.title_romanji);
  push(song.title_listed);
  const aliases = TITLE_ALIASES[String(song.title ?? "").trim()] ?? [];
  for (const a of aliases) push(a);
  return out;
}

function titleScore(song, spotifyTitle) {
  const nb = normalizeTitle(spotifyTitle);
  const cb = compactTitle(spotifyTitle);
  if (!nb) return 0;
  let best = 0;
  for (const cand of titleCandidates(song)) {
    const na = normalizeTitle(cand);
    const ca = compactTitle(cand);
    if (!na) continue;
    if (na === nb || ca === cb) return 100;
    if (na.includes(nb) || nb.includes(na) || ca.includes(cb) || cb.includes(ca)) {
      best = Math.max(best, 85);
      continue;
    }
    const ta = new Set(na.split(" ").filter(Boolean));
    const tb = new Set(nb.split(" ").filter(Boolean));
    let hit = 0;
    for (const t of ta) if (tb.has(t)) hit += 1;
    if (ta.size + tb.size > 0) {
      best = Math.max(best, Math.round((200 * hit) / (ta.size + tb.size)));
    }
  }
  return best;
}

async function itunesLookup(trackId) {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&country=jp`);
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function loadSpotifyTracksFromEmbed(artistId) {
  const res = await fetch(`https://open.spotify.com/embed/artist/${artistId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ja,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Spotify embed ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Spotify embed missing __NEXT_DATA__");
  const data = JSON.parse(m[1]);
  const list = data?.props?.pageProps?.state?.data?.entity?.trackList ?? [];
  return list
    .map((t) => {
      const id = String(t.uri ?? "").replace("spotify:track:", "");
      if (!id) return null;
      return {
        id,
        name: String(t.title ?? ""),
        preview_url: t.audioPreview?.url ?? null,
        external_url: `https://open.spotify.com/track/${id}`,
        source: "embed_top_tracks",
      };
    })
    .filter(Boolean);
}

async function getSpotifyToken() {
  const id = String(process.env.SPOTIFY_CLIENT_ID ?? "").trim();
  const secret = String(process.env.SPOTIFY_CLIENT_SECRET ?? "").trim();
  if (!id || !secret) return null;
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return String(data.access_token ?? "");
}

async function fetchAllSpotifyArtistTracks(token, artistId) {
  const headers = { Authorization: `Bearer ${token}` };
  const albums = [];
  let url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single,compilation&market=JP&limit=50`;
  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Spotify albums ${res.status}`);
    const data = await res.json();
    for (const a of data.items ?? []) albums.push(a);
    url = data.next || null;
    await sleep(120);
  }

  const seenAlbum = new Set();
  const tracks = [];
  for (const album of albums) {
    const albumId = album.id;
    if (!albumId || seenAlbum.has(albumId)) continue;
    seenAlbum.add(albumId);
    let tUrl = `https://api.spotify.com/v1/albums/${albumId}/tracks?market=JP&limit=50`;
    while (tUrl) {
      const res = await fetch(tUrl, { headers });
      if (!res.ok) throw new Error(`Spotify album tracks ${res.status}`);
      const data = await res.json();
      for (const t of data.items ?? []) {
        tracks.push({
          id: t.id,
          name: t.name,
          preview_url: t.preview_url ?? null,
          external_url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
          source: "api_catalog",
        });
      }
      tUrl = data.next || null;
      await sleep(100);
    }
  }

  const byId = new Map();
  for (const t of tracks) {
    if (!t.id || byId.has(t.id)) continue;
    byId.set(t.id, t);
  }
  return [...byId.values()];
}

function matchSpotifyTrack(song, spotifyTracks) {
  let best = null;
  let bestScore = 0;
  const exactNorm = normalizeTitle(song.title);
  for (const t of spotifyTracks) {
    let score = titleScore(song, t.name);
    // Prefer exact JP/title match over romanized alias when both are strong.
    if (exactNorm && normalizeTitle(t.name) === exactNorm) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (bestScore < 70) return null;
  return { track: best, score: bestScore };
}

async function main() {
  const songs = JSON.parse(fs.readFileSync(songsPath, "utf8"));
  const rows = songs.filter((s) => String(s.group_uid ?? "") === GROUP_UID);
  console.log(`Akishibu songs: ${rows.length}`);

  let spotifyTracks = [];
  try {
    const token = await getSpotifyToken();
    if (token) {
      console.log("Spotify credentials found — loading full artist catalog…");
      spotifyTracks = await fetchAllSpotifyArtistTracks(token, SPOTIFY_ARTIST_ID);
    } else {
      console.log("Loading Spotify top tracks from public embed…");
      spotifyTracks = await loadSpotifyTracksFromEmbed(SPOTIFY_ARTIST_ID);
    }
    console.log(`Spotify tracks loaded: ${spotifyTracks.length}`);
  } catch (e) {
    console.warn("Spotify catalog load failed:", e instanceof Error ? e.message : e);
  }

  const stats = {
    appleMusicUrl: 0,
    applePreviewUrl: 0,
    spotifyUrl: 0,
    spotifyPreviewUrl: 0,
    appleFail: 0,
    spotifyMiss: 0,
  };

  for (const song of rows) {
    const appleIds = Array.isArray(song._apple_track_ids) ? song._apple_track_ids : [];
    const primaryId = appleIds[0];
    if (primaryId == null) {
      stats.appleFail += 1;
    } else {
      try {
        const meta = await itunesLookup(primaryId);
        await sleep(80);
        if (meta) {
          const appleUrl = cleanAppleUrl(meta.trackViewUrl) || cleanAppleUrl(meta.collectionViewUrl);
          const preview = String(meta.previewUrl ?? "").trim() || null;
          if (appleUrl) {
            song.apple_music_url = appleUrl;
            stats.appleMusicUrl += 1;
          }
          if (preview) {
            song.apple_preview_url = preview;
            stats.applePreviewUrl += 1;
          }
        } else {
          stats.appleFail += 1;
        }
      } catch (e) {
        stats.appleFail += 1;
        console.warn(`iTunes fail ${song.title}:`, e instanceof Error ? e.message : e);
      }
    }

    if (!("apple_music_url" in song)) song.apple_music_url = null;
    if (!("apple_preview_url" in song)) song.apple_preview_url = null;
    if (!("spotify_url" in song)) song.spotify_url = null;
    if (!("spotify_preview_url" in song)) song.spotify_preview_url = null;

    if (spotifyTracks.length) {
      const match = matchSpotifyTrack(song, spotifyTracks);
      if (match) {
        song.spotify_url = match.track.external_url;
        song.spotify_preview_url = match.track.preview_url;
        stats.spotifyUrl += 1;
        if (match.track.preview_url) stats.spotifyPreviewUrl += 1;
        console.log(`Spotify match (${match.score}): ${song.title} -> ${match.track.name}`);
      } else {
        stats.spotifyMiss += 1;
        // Keep existing values if any; otherwise null
        song.spotify_url = song.spotify_url || null;
        song.spotify_preview_url = song.spotify_preview_url || null;
      }
    }
  }

  console.log("Stats:", stats);

  if (dryRun) {
    console.log("Dry run — not writing songs.json");
    const sample = rows
      .filter((s) => s.spotify_url || s.apple_preview_url)
      .slice(0, 5)
      .map((s) => ({
        title: s.title,
        apple_music_url: s.apple_music_url,
        apple_preview_url: Boolean(s.apple_preview_url),
        spotify_url: s.spotify_url,
        spotify_preview_url: Boolean(s.spotify_preview_url),
      }));
    console.log(JSON.stringify(sample, null, 2));
    return;
  }

  fs.writeFileSync(songsPath, `${JSON.stringify(songs, null, 2)}\n`, "utf8");
  console.log(`Wrote ${songsPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
