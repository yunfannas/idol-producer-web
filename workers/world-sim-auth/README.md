# World Simulator auth worker

Deploy (after setting secrets):

```bash
cd workers/world-sim-auth
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ALLOWED_GITHUB_LOGINS
# optional vars in dashboard: GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, REVISIONS_PATH, ALLOWED_ORIGINS
npx wrangler deploy
```

GitHub OAuth App:
- Homepage: Pages URL
- Callback: `https://<worker>/auth/callback`

Frontend:
- Set `localStorage.worldSimAuthApi = "https://<worker>"` or open `world-sim/?auth=https://<worker>`
