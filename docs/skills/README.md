# Project skills (idol_producer)

Agent skills for this repo live here as `skills/<skill-name>/SKILL.md`.

Cursor expects skills under **`.cursor/skills/`**. This project keeps the real files in **`skills/`** at the repo root and uses a **directory link** so `.cursor/skills` points at this folder.

## One-time setup (after clone)

From the repository root (`idol_producer`).

### Windows (directory junction)

```powershell
if (Test-Path .cursor\skills) { Remove-Item .cursor\skills -Recurse -Force }
New-Item -ItemType Junction -Path .cursor\skills -Target "$PWD\skills"
```

Or run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/link_cursor_skills.ps1
```

### macOS / Linux (symlink)

From the repository root:

```bash
mkdir -p .cursor
rm -rf .cursor/skills
ln -sfn "$(pwd)/skills" .cursor/skills
```

## Verify

`.cursor/skills` should list the same skill folders as `skills/` (for example `apple-music-song-update`).
