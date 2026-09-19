/**
 * World Simulator auth + revision writer (Cloudflare Worker).
 *
 * Secrets / vars:
 * - GITHUB_CLIENT_ID
 * - GITHUB_CLIENT_SECRET
 * - GITHUB_TOKEN (repo contents:write on idol-producer-web)
 * - ALLOWED_GITHUB_LOGINS (comma-separated)
 * - SESSION_SECRET
 * - GITHUB_OWNER (default yunfannas)
 * - GITHUB_REPO (default idol-producer-web)
 * - GITHUB_BRANCH (default main)
 * - REVISIONS_PATH (default public/data/l3-world-viewer/revisions)
 * - ALLOWED_ORIGINS (comma-separated Pages origins)
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = parseList(env.ALLOWED_ORIGINS);
  const ok = !origin || allowed.length === 0 || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

async function hmacSign(secret, payload) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function makeSession(env, login, canEdit) {
  const body = btoa(JSON.stringify({ login, can_edit: canEdit, exp: Date.now() + 1000 * 60 * 60 * 12 }));
  const sig = await hmacSign(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

async function readSession(env, request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)ws_session=([^;]+)/);
  if (!match) return null;
  const [body, sig] = decodeURIComponent(match[1]).split(".");
  if (!body || !sig) return null;
  const expect = await hmacSign(env.SESSION_SECRET, body);
  if (expect !== sig) return null;
  try {
    const data = JSON.parse(atob(body));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function sessionCookie(value, clear = false) {
  if (clear) return "ws_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None";
  return `ws_session=${encodeURIComponent(value)}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=None`;
}

function canEditLogin(env, login) {
  const allow = parseList(env.ALLOWED_GITHUB_LOGINS).map((s) => s.toLowerCase());
  return allow.includes(String(login || "").toLowerCase());
}

async function githubJson(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "idol-world-sim-worker",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text}`);
  return data;
}

function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    try {
      if (url.pathname === "/auth/login") {
        const returnTo = url.searchParams.get("return_to") || "";
        const state = btoa(JSON.stringify({ return_to: returnTo }));
        const gh = new URL("https://github.com/login/oauth/authorize");
        gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
        gh.searchParams.set("redirect_uri", `${url.origin}/auth/callback`);
        gh.searchParams.set("scope", "read:user");
        gh.searchParams.set("state", state);
        return Response.redirect(gh.toString(), 302);
      }

      if (url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code");
        const stateRaw = url.searchParams.get("state");
        let returnTo = "/";
        try {
          returnTo = JSON.parse(atob(stateRaw || "")).return_to || "/";
        } catch {
          /* ignore */
        }
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });
        const tokenJson = await tokenRes.json();
        if (!tokenJson.access_token) return json({ error: "oauth_token_failed", detail: tokenJson }, 400, headers);
        const user = await githubJson(tokenJson.access_token, "https://api.github.com/user");
        const login = user.login;
        const editable = canEditLogin(env, login);
        const session = await makeSession(env, login, editable);
        return new Response(null, {
          status: 302,
          headers: {
            ...headers,
            Location: returnTo,
            "Set-Cookie": sessionCookie(session),
          },
        });
      }

      if (url.pathname === "/auth/me") {
        const session = await readSession(env, request);
        if (!session) return json({ login: null, can_edit: false }, 200, headers);
        return json(
          { login: session.login, can_edit: Boolean(session.can_edit && canEditLogin(env, session.login)) },
          200,
          headers
        );
      }

      if (url.pathname === "/auth/logout" && request.method === "POST") {
        return json({ ok: true }, 200, { ...headers, "Set-Cookie": sessionCookie("", true) });
      }

      if (url.pathname === "/api/revisions" && request.method === "POST") {
        const session = await readSession(env, request);
        if (!session?.login || !session.can_edit || !canEditLogin(env, session.login)) {
          return json({ error: "forbidden" }, 403, headers);
        }
        const patch = await request.json();
        const savedAt = new Date().toISOString();
        const stamp = savedAt.replace(/[:.]/g, "").replace("Z", "Z");
        const shortid = crypto.randomUUID().slice(0, 8);
        const file = `${stamp}__${session.login}__${shortid}.json`;
        const owner = env.GITHUB_OWNER || "yunfannas";
        const repo = env.GITHUB_REPO || "idol-producer-web";
        const branch = env.GITHUB_BRANCH || "main";
        const basePath = (env.REVISIONS_PATH || "public/data/l3-world-viewer/revisions").replace(/\/$/, "");
        const revision = {
          revision_id: `${stamp}__${session.login}__${shortid}`,
          saved_at: savedAt,
          author_github_login: session.login,
          base_manifest_generated_at: patch.base_manifest_generated_at || null,
          month: patch.month || null,
          note: patch.note || "",
          patches: patch.patches || { group_monthly: [], member_monthly: [], world_monthly: [] },
        };
        const filePath = `${basePath}/${file}`;
        await githubJson(env.GITHUB_TOKEN, `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
          method: "PUT",
          body: JSON.stringify({
            message: `world-sim: revision ${file} by ${session.login}`,
            content: b64encode(JSON.stringify(revision, null, 2) + "\n"),
            branch,
          }),
        });

        // Update index.json
        const indexPath = `${basePath}/index.json`;
        let indexSha = null;
        let indexDoc = { revisions: [] };
        try {
          const existing = await githubJson(
            env.GITHUB_TOKEN,
            `https://api.github.com/repos/${owner}/${repo}/contents/${indexPath}?ref=${branch}`
          );
          indexSha = existing.sha;
          indexDoc = JSON.parse(atob(String(existing.content || "").replace(/\n/g, "")));
        } catch {
          indexDoc = { revisions: [] };
        }
        indexDoc.revisions = indexDoc.revisions || [];
        indexDoc.revisions.push({
          saved_at: savedAt,
          author: session.login,
          file,
          path: `revisions/${file}`,
          month: revision.month,
        });
        await githubJson(env.GITHUB_TOKEN, `https://api.github.com/repos/${owner}/${repo}/contents/${indexPath}`, {
          method: "PUT",
          body: JSON.stringify({
            message: `world-sim: index revision ${file}`,
            content: b64encode(JSON.stringify(indexDoc, null, 2) + "\n"),
            branch,
            ...(indexSha ? { sha: indexSha } : {}),
          }),
        });

        return json({ ok: true, revision_id: revision.revision_id, saved_at: savedAt, file }, 200, headers);
      }

      return json({ error: "not_found" }, 404, headers);
    } catch (err) {
      return json({ error: "server_error", message: String(err?.message || err) }, 500, headers);
    }
  },
};
