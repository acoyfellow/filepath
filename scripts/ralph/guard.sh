#!/usr/bin/env bash
set -euo pipefail

constraints_file="${1:-}"

if [[ -z "$constraints_file" || ! -f "$constraints_file" ]]; then
  echo "Usage: $0 <constraints.json>" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for guard checks" >&2
  exit 1
fi

pause_pattern='^[[:space:]]*-[[:space:]]*PAUSED:[[:space:]]*true'
paused_file=$(jq -r '.pausedFlagFile // "AGENTS.md"' "$constraints_file")
if [[ -f "$paused_file" ]] && grep -qi "$pause_pattern" "$paused_file"; then
  echo "Loop is paused; guard blocking changes" >&2
  exit 1
fi

mapfile -t allowed_paths < <(jq -r '.allowedPaths[]' "$constraints_file")
mapfile -t required_json < <(jq -r '.jsonRequired[]' "$constraints_file")
max_line_delta=$(jq -r '.maxLineDelta // 800' "$constraints_file")
max_files=$(jq -r '.maxFiles // 0' "$constraints_file")
if [[ ${#allowed_paths[@]} -eq 0 ]]; then
  echo "Guard failed: constraints.json missing allowedPaths entries" >&2
  exit 1
fi
if [[ ${#required_json[@]} -eq 0 ]]; then
  echo "Guard failed: constraints.json missing jsonRequired entries" >&2
  exit 1
fi

for json_file in "${required_json[@]}"; do
  if [[ ! -f "$json_file" ]]; then
    echo "Missing required JSON file: $json_file" >&2
    exit 1
  fi
  jq empty "$json_file" >/dev/null
done

mapfile -t changed_files < <(git diff --name-only HEAD)
mapfile -t untracked < <(git ls-files --others --exclude-standard)
if [[ ${#untracked[@]} -gt 0 ]]; then
  changed_files+=("${untracked[@]}")
fi

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No changes detected; guard is green."
  exit 0
fi

if (( max_files > 0 )) && (( ${#changed_files[@]} > max_files )); then
  echo "Guard failed: changed file count ${#changed_files[@]} exceeds maxFiles $max_files" >&2
  exit 1
fi

for file in "${changed_files[@]}"; do
  if [[ -d "$file" ]]; then
    continue
  fi
  match=false
  for pattern in "${allowed_paths[@]}"; do
    case "$file" in
      $pattern) match=true ;;
    esac
    if $match; then break; fi
  done
  if ! $match; then
    echo "Guard failed: $file is outside allowedPaths" >&2
    exit 1
  fi
done

# Total changed lines (additions + deletions); +0 forces numeric output when no rows exist.
line_delta=$(git diff --numstat HEAD | awk '{add+=$1; del+=$2} END {print (add+del)+0}')
if (( line_delta > max_line_delta )); then
  echo "Guard failed: line delta $line_delta exceeds limit $max_line_delta" >&2
  exit 1
fi

echo "Guard checks passed."
