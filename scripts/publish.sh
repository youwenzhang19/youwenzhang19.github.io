#!/usr/bin/env bash
# Publish local homepage changes to GitHub Pages (youwenzhang19.github.io).
#
# Usage:
#   ./scripts/publish.sh                    # status + push (commit first if dirty)
#   ./scripts/publish.sh -m "your message"  # add all, commit, push
#   ./scripts/publish.sh --dry-run          # show status / whoami only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPECTED_USER="youwenzhang19"
REMOTE_URL="https://github.com/youwenzhang19/youwenzhang19.github.io.git"
SITE_URL="https://youwenzhang19.github.io/"

MSG=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) MSG="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

GH="$ROOT/.tools/gh"
if [[ ! -x "$GH" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH="$(command -v gh)"
  else
    GH=""
  fi
fi

die() { echo "error: $*" >&2; exit 1; }

check_remote() {
  local url
  url="$(git remote get-url origin 2>/dev/null || true)"
  [[ -n "$url" ]] || die "no origin remote"
  if [[ "$url" != *"youwenzhang19/youwenzhang19.github.io"* ]]; then
    die "origin is not youwenzhang19.github.io (got: $url)"
  fi
}

check_auth() {
  if [[ -z "$GH" ]]; then
    echo "warn: gh not found; skipping login check (push may prompt)"
    return 0
  fi
  if ! "$GH" auth status -h github.com >/dev/null 2>&1; then
    echo "error: not logged in. Run: ./scripts/gh-login.sh" >&2
    return 1
  fi
  local login
  login="$("$GH" api user --jq .login 2>/dev/null || true)"
  if [[ -z "$login" ]]; then
    echo "error: gh token invalid / Forbidden. Run: ./scripts/gh-login.sh" >&2
    return 1
  fi
  if [[ "$login" != "$EXPECTED_USER" ]]; then
    echo "error: git/gh is $login, need $EXPECTED_USER. Run: ./scripts/gh-login.sh" >&2
    return 1
  fi
  echo "auth: $login OK"
  return 0
}

echo "==> repo: $ROOT"
check_remote
if ! check_auth; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "warn: auth check failed (dry-run continues)"
  else
    exit 1
  fi
fi

echo "==> status"
git status -sb
git remote -v | head -2

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "dry-run: stop before commit/push"
  exit 0
fi

# Commit if message provided, or if working tree dirty without message → ask
if [[ -n "$(git status --porcelain)" ]]; then
  if [[ -z "$MSG" ]]; then
    die "working tree dirty. Commit first, or: ./scripts/publish.sh -m \"message\""
  fi
  git add -A
  # avoid committing junk
  git reset HEAD -- .DS_Store 2>/dev/null || true
  git commit -m "$MSG"
fi

BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == "main" ]] || die "on branch '$BRANCH', expected main"

echo "==> push origin main"
git push -u origin main

echo "OK → $SITE_URL"
echo "    course notes e.g. ${SITE_URL}courses/galactic-physics.html"
echo "    (Pages may take ~1 min to refresh)"
