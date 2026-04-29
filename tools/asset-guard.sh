#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: asset-guard.sh <dist_dir>" >&2
  exit 2
fi

DIST="$1"
if [ ! -d "$DIST" ]; then
  echo "asset-guard: dist dir not found: $DIST" >&2
  exit 2
fi

FAILURES=()
WARNINGS=()
COUNT=0

filesize() {
  # Portable size in bytes (BSD vs GNU stat)
  if stat -f%z "$1" >/dev/null 2>&1; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

human_kb() {
  awk -v b="$1" 'BEGIN { printf "%.1f KB", b/1024 }'
}

# Walk all files once
while IFS= read -r f; do
  COUNT=$((COUNT + 1))
  base=$(basename "$f")
  lower=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')

  case "$lower" in
    .ds_store)
      FAILURES+=(".DS_Store present: $f")
      continue
      ;;
    *.otf|*.ttf|*.eot|*.woff)
      FAILURES+=("forbidden font format: $f")
      continue
      ;;
    *.tiff|*.gif|*.bmp)
      FAILURES+=("forbidden image format: $f")
      continue
      ;;
  esac

  size=$(filesize "$f")

  case "$lower" in
    *.png|*.jpg|*.jpeg|*.webp|*.avif)
      if [ "$size" -gt 204800 ]; then
        FAILURES+=("image > 200 KB: $f ($(human_kb "$size"))")
        continue
      elif [ "$size" -gt 102400 ]; then
        WARNINGS+=("image > 100 KB: $f ($(human_kb "$size"))")
      fi
      ;;
    *.woff2)
      if [ "$size" -gt 35840 ]; then
        WARNINGS+=("woff2 > 35 KB: $f ($(human_kb "$size"))")
      fi
      ;;
  esac

  # Content-hash check on hashable asset extensions
  case "$lower" in
    *.js|*.css|*.wasm|*.woff2|*.svg|*.png|*.jpg|*.jpeg|*.webp|*.avif)
      # Pattern: name.<8+ hex>.ext
      if ! printf '%s' "$base" | grep -Eq '\.[a-f0-9]{8,}\.[a-zA-Z0-9]+$'; then
        WARNINGS+=("asset without content-hash: $f")
      fi
      ;;
  esac
done < <(find "$DIST" -type f)

# Soft sourcemap check
if command -v grep >/dev/null 2>&1; then
  if grep -rIE 'sourceMappingURL=.*\.map' "$DIST" 2>/dev/null \
       | grep -vE ':\s*(//|/\*|#)\s*sourceMappingURL' \
       | grep -vE '\.html?:' >/dev/null; then
    WARNINGS+=("sourceMappingURL references found in non-html files (review)")
  fi
fi

# Print warnings
if [ "${#WARNINGS[@]}" -gt 0 ]; then
  for w in "${WARNINGS[@]}"; do
    echo "asset-guard: WARN $w"
  done
fi

# Print failures and exit
if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo "asset-guard: FAIL — ${#FAILURES[@]} issue(s):" >&2
  for x in "${FAILURES[@]}"; do
    echo "  - $x" >&2
  done
  exit 1
fi

echo "asset-guard: PASS — $COUNT assets checked"
exit 0
