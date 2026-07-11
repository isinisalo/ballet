#!/bin/sh
set -eu

VERSION=${1:-}
CHECKSUMS=${2:-}
OUTPUT=${3:-Formula/ballet.rb}
[ -n "$VERSION" ] && [ -f "$CHECKSUMS" ] || {
  printf 'usage: %s <version> <checksums.txt> [output]\n' "$0" >&2
  exit 2
}
case "$VERSION" in *[!0-9A-Za-z._-]*) printf 'invalid release version: %s\n' "$VERSION" >&2; exit 2 ;; esac

checksum() {
  awk -v name="$1" '$2 == name || $2 == "*" name { print $1; exit }' "$CHECKSUMS"
}

ARM64=$(checksum "ballet_${VERSION}_darwin_arm64.tar.gz")
X64=$(checksum "ballet_${VERSION}_darwin_x64.tar.gz")
case "$ARM64:$X64" in
  *[!0-9a-fA-F:]*|:*) printf 'both release checksums are required\n' >&2; exit 1 ;;
esac
[ "${#ARM64}" -eq 64 ] && [ "${#X64}" -eq 64 ] || { printf 'release checksums must be SHA256\n' >&2; exit 1; }

mkdir -p "$(dirname "$OUTPUT")"
sed \
  -e "s/{{VERSION}}/$VERSION/g" \
  -e "s/{{ARM64_SHA256}}/$ARM64/g" \
  -e "s/{{X64_SHA256}}/$X64/g" \
  packaging/Formula/ballet.rb.template > "$OUTPUT"
