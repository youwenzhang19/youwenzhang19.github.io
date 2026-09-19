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

GitHub Pages (same pattern as [donglai6.github.io](https://donglai6.github.io/)):

- Repo: `youwenzhang19/youwenzhang19.github.io`
- Site: https://youwenzhang19.github.io/
- Build command: (none) — publish from `main` / root
- Calendar window is **manual**: edit `data/schedule.json` → `window`.
