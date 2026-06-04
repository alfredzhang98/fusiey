#!/usr/bin/env bash
# PostToolUse hook — restart the Fusiey backend dev server when server TS
# files change. Reads the tool-input JSON from stdin, extracts the file
# path, and only acts when the path is inside server/src or shared/types.
#
# Debounce: a burst of edits within 1.5s collapses into a single restart
# (each invocation writes a fresh timestamp to the trigger file; only the
# LAST one matches when the sleep expires, so earlier ones skip restart).

set -u

# 1. Extract the file_path from tool-input JSON on stdin. Uses node (always
#    available in this project) instead of jq (which isn't installed on
#    this git-bash on Windows).
input="$(cat)"
file_path="$(
  printf '%s' "$input" | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        process.stdout.write(j.tool_input?.file_path || j.tool_response?.filePath || "");
      } catch { /* malformed input — silently skip */ }
    });
  ' 2>/dev/null
)"

[ -z "$file_path" ] && exit 0

# 2. Path filter — only server/src or shared/types TypeScript files.
#    Accept both forward- and back-slash paths (Windows via git-bash).
case "$file_path" in
  */server/src/*.ts|*/server/src/*.tsx|*\\server\\src\\*.ts|*\\server\\src\\*.tsx) ;;
  */shared/types/*.ts|*\\shared\\types\\*.ts) ;;
  *) exit 0 ;;
esac

# 3. Debounced restart. Stamp this invocation, spawn a detached watcher that
#    sleeps and only acts if its stamp is still the latest.
TRIGGER=/tmp/fusiey-restart-trigger
LOG=/tmp/fusiey-server.log
STAMP="$(date +%s%N)"
printf '%s\n' "$STAMP" > "$TRIGGER"

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Detach fully — no open FDs to the hook-invoker, so Claude's hook call
# returns immediately and the restart happens asynchronously.
(
  sleep 1.5
  latest="$(cat "$TRIGGER" 2>/dev/null)"
  [ "$latest" = "$STAMP" ] || exit 0

  # Kill whoever is listening on :3000 (best-effort).
  npx kill-port 3000 >/dev/null 2>&1 || true

  # Relaunch tsx in background, redirect all output to the log.
  cd "$PROJECT_DIR" || exit 0
  nohup npx tsx server/src/app.ts >"$LOG" 2>&1 &
  disown || true
) </dev/null >/dev/null 2>&1 &
disown || true

exit 0
