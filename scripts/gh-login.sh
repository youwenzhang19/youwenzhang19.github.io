#!/usr/bin/env bash
# One-time / repair GitHub auth for this site (must be youwenzhang19).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GH="$ROOT/.tools/gh"
if [[ ! -x "$GH" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH="$(command -v gh)"
  else
    echo "error: gh not found. Expected $ROOT/.tools/gh" >&2
    exit 1
  fi
fi

echo "==> Clear stale github.com HTTPS credentials from macOS keychain"
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain erase || true

echo "==> Login as youwenzhang19 (HTTPS + browser or token)"
echo "    Do NOT use your GitHub account password for git."
echo "    If asked for a password later, paste a PAT with 'repo' scope."
"$GH" auth logout -h github.com 2>/dev/null || true
"$GH" auth login -h github.com -p https -w

echo "==> Wire git to use gh credentials"
"$GH" auth setup-git

echo "==> Check account"
LOGIN="$("$GH" api user --jq .login)"
echo "    logged in as: $LOGIN"
if [[ "$LOGIN" != "youwenzhang19" ]]; then
  echo "error: expected youwenzhang19, got $LOGIN" >&2
  echo "       run: $GH auth logout -h github.com && $0" >&2
  exit 1
fi

echo "OK. Auth ready for https://github.com/youwenzhang19/youwenzhang19.github.io"
