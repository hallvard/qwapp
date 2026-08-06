#!/usr/bin/env bash
set -euo pipefail

runner_pids=()

usage() {
  echo "Usage: $0 <frontend-dir> [<frontend-dir> ...]" >&2
  echo "Example (from sample-app): $0 ../qwapp-core/frontend ../qwapp-settings/frontend" >&2
}

cleanup() {
  for pid in "${runner_pids[@]-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

resolve_frontend_dir() {
  local input_dir="$1"

  if [[ -d "$input_dir" ]]; then
    (cd "$input_dir" && pwd)
    return 0
  fi

  return 1
}

start_frontend_watcher() {
  local label="$1"
  local frontend_dir="$2"
  local -a watch_cmd=()

  (
    cd "$frontend_dir"

    if [[ -f "package.json" ]] && rg -q '"watch"\s*:' package.json; then
      watch_cmd=(npm run watch)
    elif [[ -f "vite.module.config.ts" ]]; then
      watch_cmd=(npx vite build --watch --config vite.module.config.ts)
    elif [[ -f "vite.config.ts" ]]; then
      watch_cmd=(npx vite build --watch --config vite.config.ts)
    else
      watch_cmd=(npx vite build --watch)
    fi

    echo "[$label] cd $frontend_dir && ${watch_cmd[*]}"

    "${watch_cmd[@]}" &
    local vite_pid=$!

    wait "$vite_pid"
  ) &

  runner_pids+=("$!")
  return 0
}

watcher_count=0

if [[ "$#" -eq 0 ]]; then
  usage
  exit 1
fi

for input_dir in "$@"; do
  if frontend_dir="$(resolve_frontend_dir "$input_dir")"; then
    module_name="$(basename "$(dirname "$frontend_dir")")"
    if start_frontend_watcher "$module_name" "$frontend_dir"; then
      watcher_count=$((watcher_count + 1))
      echo "Started frontend watcher for $module_name"
    fi
  else
    echo "Frontend directory not found: $input_dir" >&2
  fi
done

if [[ "$watcher_count" -eq 0 ]]; then
  echo "No valid frontend directories were provided." >&2
  exit 1
fi

wait "${runner_pids[@]}"
