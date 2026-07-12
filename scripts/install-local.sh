#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VERSION=$(node -p "require('$ROOT/package.json').version")

case "$(uname -m)" in
  arm64) ARCH=arm64 ;;
  x86_64) ARCH=x64 ;;
  *) printf 'unsupported architecture: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac

PREFIX=${BALLET_INSTALL_PREFIX:-$HOME/.local}
case "$PREFIX" in
  ""|/) printf 'BALLET_INSTALL_PREFIX must name a dedicated installation prefix\n' >&2; exit 1 ;;
esac

OUTPUT_DIR="$ROOT/release"
ARCHIVE="$OUTPUT_DIR/ballet_${VERSION}_darwin_${ARCH}.tar.gz"

cd "$ROOT"
npm run release:build -- "$VERSION" "$ARCH" "$OUTPUT_DIR"

TMP=$(mktemp -d "${TMPDIR:-/tmp}/ballet-local-install.XXXXXX")
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
tar -xzf "$ARCHIVE" -C "$TMP"

[ -x "$TMP/ballet" ] || { printf 'release archive is missing the ballet launcher\n' >&2; exit 1; }
[ -x "$TMP/libexec/ballet/node" ] || { printf 'release archive is missing the packaged Node runtime\n' >&2; exit 1; }
[ -f "$TMP/libexec/ballet/dist-server/backend/cli/main.js" ] || { printf 'release archive is missing the packaged CLI\n' >&2; exit 1; }
[ -f "$TMP/share/ballet/dist/index.html" ] || { printf 'release archive is missing the web application\n' >&2; exit 1; }

ARCHIVE_HASH=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')
BIN_DIR="$PREFIX/bin"
VERSIONS_DIR="$PREFIX/libexec/ballet/versions"
mkdir -p "$BIN_DIR" "$VERSIONS_DIR"
BUNDLE=$(mktemp -d "${VERSIONS_DIR}/ballet-${VERSION}-${ARCHIVE_HASH}.XXXXXX")
cp "$TMP/ballet" "$BUNDLE/ballet"
cp -R "$TMP/libexec" "$BUNDLE/libexec"
cp -R "$TMP/share" "$BUNDLE/share"
chmod 0755 "$BUNDLE/ballet" "$BUNDLE/libexec/ballet/node"

"$BUNDLE/ballet" version | grep -Fx "$VERSION" >/dev/null || {
  printf 'the local bundle failed its version check\n' >&2
  exit 1
}

LINK="$BIN_DIR/.ballet.new.$$"
rm -f "$LINK"
ln -s "../libexec/ballet/versions/$(basename "$BUNDLE")/ballet" "$LINK"
mv -f "$LINK" "$BIN_DIR/ballet"

case ":$PATH:" in
  *":${BIN_DIR}:"*) ;;
  *) printf '\nAdd %s to PATH before continuing.\n' "$BIN_DIR" ;;
esac

printf '\nInstalled local Ballet %s to %s/ballet.\n' "$VERSION" "$BIN_DIR"
printf 'Start Ballet from a committed Git checkout root:\n  cd <checkout> && ballet\n'
