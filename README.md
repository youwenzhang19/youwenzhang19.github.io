# Youwen Zhang's Home Page

Static personal site: projects / courses / calendar / music / life.

## Local

```bash
./serve.sh
# http://127.0.0.1:8765/
```

## Layout

```
index.html          # hub
schedule/           # calendar (manual window in data/schedule.json)
papers/             # reading list (manual in data/papers.json)
projects/           # project pages
courses/            # course pages
music/              # music notes
life/               # life notes
data/               # JSON + calendar.ics
assets/img/         # avatar, project thumbs, music photos
assets/ref/         # design references (not linked)
css/ js/ fonts/
```

## Deploy

Static site — Cloudflare Pages or GitHub Pages.

- Build command: (none)
- Output directory: `/` (repo root)
- Calendar window is **manual**: edit `data/schedule.json` → `window`.
