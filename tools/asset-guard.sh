#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: asset-guard.sh <dist_dir> [override_json]" >&2
  exit 2
fi

DIST="$1"
OVERRIDE="${2:-}"
if [ ! -d "$DIST" ]; then
  echo "asset-guard: dist dir not found: $DIST" >&2
  exit 2
fi

# Build the exemption table from the override JSON. Each line:
#   <relative-path>\t<sunset-YYYY-MM-DD>\t<reason>
# Paths are matched against the file path relative to <dist_dir>.
EXEMPT_TSV="$(mktemp)"
trap 'rm -f "$EXEMPT_TSV"' EXIT

if [ -n "$OVERRIDE" ]; then
  if [ ! -f "$OVERRIDE" ]; then
    echo "asset-guard: override file not found: $OVERRIDE" >&2
    exit 2
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "asset-guard: jq is required to parse $OVERRIDE" >&2
    exit 2
  fi
  jq -r '.exempt[]? | [.path, (.sunset // "9999-12-31"), (.reason // "")] | @tsv' "$OVERRIDE" > "$EXEMPT_TSV"
fi

TODAY="$(date -u +%Y-%m-%d)"

# Returns 0 (true) and prints "<sunset>\t<reason>" when $1 is exempt + not yet
# past sunset; non-zero otherwise. NB: awk's `exit` always runs the END block,
# so we use a flag and let END set the final exit code.
is_exempt() {
  local rel="$1"
  [ -s "$EXEMPT_TSV" ] || return 1
  awk -F'\t' -v p="$rel" -v today="$TODAY" '
    $1 == p {
      if ($2 >= today) { print $2 "\t" $3; found=1 }
      exit
    }
    END { exit (found ? 0 : 1) }
  ' "$EXEMPT_TSV"
}

FAILURES=()
WARNINGS=()
EXEMPTIONS=()
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

# Record a failure unless the file is exempt + still within sunset window;
# in that case, record an EXEMPTION (loud warning) instead.
fail() {
  local rel="$1"
  local msg="$2"
  if exinfo=$(is_exempt "$rel"); then
    EXEMPTIONS+=("$msg [EXEMPT until $(printf '%s' "$exinfo" | cut -f1) — $(printf '%s' "$exinfo" | cut -f2-)]")
  else
    FAILURES+=("$msg")
  fi
}

# Strip a leading "$DIST/" from a path so override entries can use repo-relative
# (e.g. "fonts/avenir.otf") regardless of how DIST is invoked.
relpath() {
  local p="$1"
  case "$p" in
    "$DIST"/*) printf '%s' "${p#"$DIST"/}" ;;
    *)         printf '%s' "$p" ;;
  esac
}

# Walk all files once
while IFS= read -r f; do
  COUNT=$((COUNT + 1))
  base=$(basename "$f")
  lower=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')
  rel=$(relpath "$f")

  case "$lower" in
    .ds_store)
      fail "$rel" ".DS_Store present: $f"
      continue
      ;;
    *.otf|*.ttf|*.eot|*.woff)
      fail "$rel" "forbidden font format: $f"
      continue
      ;;
    *.tiff|*.gif|*.bmp)
      fail "$rel" "forbidden image format: $f"
      continue
      ;;
  esac

  size=$(filesize "$f")

  case "$lower" in
    *.png|*.jpg|*.jpeg|*.webp|*.avif)
      if [ "$size" -gt 204800 ]; then
        fail "$rel" "image > 200 KB: $f ($(human_kb "$size"))"
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

# Print exemptions loudly — these would be failures if not deferred. Emit as
# GitHub Actions ::warning so they surface in the Actions UI summary panel.
if [ "${#EXEMPTIONS[@]}" -gt 0 ]; then
  echo "asset-guard: ${#EXEMPTIONS[@]} EXEMPT issue(s) (deferred — will fail again post-sunset):"
  for e in "${EXEMPTIONS[@]}"; do
    echo "  - $e"
    # ::warning :: format renders as a yellow banner in the Actions log.
    echo "::warning ::asset-guard exempt $e"
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
