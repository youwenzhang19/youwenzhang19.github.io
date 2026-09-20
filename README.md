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

## Deploy / git 更新流程

GitHub Pages：推 `main` 根目录即上线（无 build）。

- Repo: `youwenzhang19/youwenzhang19.github.io`
- Site: https://youwenzhang19.github.io/
- 必须用 **youwenzhang19** 账号推送（不要用其他 GitHub 账号的钥匙串 token）
- GitHub **不再接受账户密码**做 `git push`；用 `gh` 登录或 PAT

### 一、首次 / 换绑账号（只需做一次）

在本机终端（不要整段带 `#` 注释粘贴）：

```bash
cd "/Users/zhangyouwen/我的云端硬盘/WORKSPACE_PROJECT/homepage"
./scripts/gh-login.sh
```

按提示用浏览器登录 **youwenzhang19**。若选 token：到
https://github.com/settings/tokens 新建 classic token（勾选 `repo`）。

### 二、日常更新上线

```bash
cd "/Users/zhangyouwen/我的云端硬盘/WORKSPACE_PROJECT/homepage"
./serve.sh   # 可选：本地预览 http://127.0.0.1:8765/
./scripts/publish.sh -m "简述这次改了什么"
```

只检查账号与状态、不推送：

```bash
./scripts/publish.sh --dry-run
```

已手动 `git commit` 过、只缺 push：

```bash
./scripts/publish.sh
```

### 三、手动等价流程

```bash
git status
git add -A
git commit -m "message"
git push -u origin main
```

若报 `denied to Stardust-charlie` 或 `Password authentication is not supported`：
重新跑 `./scripts/gh-login.sh`（会清掉旧钥匙串里的 github.com HTTPS 凭据）。

日历窗口是手动维护的：编辑 `data/schedule.json` → `window`。
