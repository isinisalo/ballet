#!/bin/sh
set -eu

REPOSITORY="${BALLET_RELEASE_REPOSITORY:-isinisalo/ballet}"
INSTALL_METHOD="${BALLET_INSTALL_METHOD:-auto}"

fail() {
  printf 'ballet installer: %s\n' "$1" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "$2"
}

[ "$(uname -s)" = "Darwin" ] || fail "the local runtime currently supports macOS only"

case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

if [ "$INSTALL_METHOD" = "homebrew" ]; then
  need brew "Homebrew was requested but is not installed"
  printf 'Installing Ballet with Homebrew...\n'
  brew install isinisalo/tap/ballet
  printf '\nInstalled. Set up this computer with:\n  ballet setup --repo <git-url>\n'
  exit 0
fi

if command -v brew >/dev/null 2>&1; then
  printf 'Homebrew alternative: brew install isinisalo/tap/ballet\n'
fi

need curl "curl is required"
need tar "tar is required"
need shasum "shasum is required"
need gh "GitHub CLI is required for fail-closed artifact attestation verification. Install it with: brew install gh"

LATEST_URL=$(curl --proto '=https' --tlsv1.2 -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${REPOSITORY}/releases/latest")
TAG=${LATEST_URL##*/}
[ -n "$TAG" ] || fail "could not determine the latest release"
VERSION=${TAG#v}
ASSET="ballet_${VERSION}_darwin_${ARCH}.tar.gz"
BASE="https://github.com/${REPOSITORY}/releases/download/${TAG}"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ballet-install.XXXXXX")
trap 'rm -rf "$TMP"' EXIT HUP INT TERM

printf 'Downloading Ballet %s...\n' "$TAG"
curl --proto '=https' --tlsv1.2 -fsSL "${BASE}/${ASSET}" -o "${TMP}/${ASSET}"
curl --proto '=https' --tlsv1.2 -fsSL "${BASE}/checksums.txt" -o "${TMP}/checksums.txt"

EXPECTED=$(awk -v asset="$ASSET" '$2 == asset || $2 == "*" asset { print $1; exit }' "${TMP}/checksums.txt")
case "$EXPECTED" in
  ""|*[!0-9a-fA-F]*) fail "release checksum is missing or invalid for ${ASSET}" ;;
esac
[ "${#EXPECTED}" -eq 64 ] || fail "release checksum has an invalid length"
ACTUAL=$(shasum -a 256 "${TMP}/${ASSET}" | awk '{print $1}')
[ "$ACTUAL" = "$EXPECTED" ] || fail "SHA256 verification failed"

printf 'Verifying GitHub artifact attestation...\n'
gh attestation verify "${TMP}/${ASSET}" --repo "$REPOSITORY" >/dev/null

tar -xzf "${TMP}/${ASSET}" -C "$TMP"
[ -f "${TMP}/ballet" ] || fail "verified archive did not contain the ballet executable"
[ -x "${TMP}/libexec/ballet/node" ] || fail "verified archive did not contain the packaged Node runtime"
[ -f "${TMP}/libexec/ballet/dist-server/backend/cli/main.js" ] || fail "verified archive did not contain the compiled Ballet CLI"
[ -f "${TMP}/libexec/ballet/node_modules/better-sqlite3/package.json" ] || fail "verified archive did not contain production dependencies"
[ -f "${TMP}/share/ballet/dist/index.html" ] || fail "verified archive did not contain the Ballet web application"
chmod 0755 "${TMP}/ballet"
chmod 0755 "${TMP}/libexec/ballet/node"
RUNTIME_ARCH=$("${TMP}/libexec/ballet/node" -p 'process.arch')
[ "$RUNTIME_ARCH" = "$ARCH" ] || fail "packaged Node architecture ${RUNTIME_ARCH} does not match ${ARCH}"

if [ -n "${BALLET_INSTALL_PREFIX:-}" ]; then
  PREFIX=$BALLET_INSTALL_PREFIX
elif [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
  PREFIX=/usr/local
else
  PREFIX="$HOME/.local"
fi
case "$PREFIX" in ""|/) fail "BALLET_INSTALL_PREFIX must name a dedicated installation prefix" ;; esac
BIN_DIR="${PREFIX}/bin"
VERSIONS_DIR="${PREFIX}/libexec/ballet/versions"
mkdir -p "$BIN_DIR" "$VERSIONS_DIR"
BUNDLE=$(mktemp -d "${VERSIONS_DIR}/ballet-${VERSION}-${EXPECTED}.XXXXXX")
cp "${TMP}/ballet" "${BUNDLE}/ballet"
cp -R "${TMP}/libexec" "${BUNDLE}/libexec"
cp -R "${TMP}/share" "${BUNDLE}/share"
chmod 0755 "${BUNDLE}/ballet" "${BUNDLE}/libexec/ballet/node"

# Validate the complete immutable bundle before exposing it. The only
# canonical-path mutation is the final same-filesystem rename of this symlink.
"${BUNDLE}/ballet" version | grep -Fx "$VERSION" >/dev/null || fail "the verified bundle failed its version check"
BUNDLE_ARCH=$("${BUNDLE}/libexec/ballet/node" -p 'process.arch')
[ "$BUNDLE_ARCH" = "$ARCH" ] || fail "installed bundle architecture ${BUNDLE_ARCH} does not match ${ARCH}"
LINK="${BIN_DIR}/.ballet.new.$$"
rm -f "$LINK"
ln -s "../libexec/ballet/versions/$(basename "$BUNDLE")/ballet" "$LINK"
mv -f "$LINK" "${BIN_DIR}/ballet"

case ":$PATH:" in
  *":${BIN_DIR}:"*) ;;
  *) printf '\nAdd %s to PATH before continuing.\n' "$BIN_DIR" ;;
esac

printf '\nInstalled verified Ballet %s to %s/ballet.\n' "$TAG" "$BIN_DIR"
printf 'Set up this computer with:\n  ballet setup --repo <git-url>\n'
