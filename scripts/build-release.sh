#!/bin/sh
set -eu

VERSION=${1:-}
ARCH=${2:-}
OUTPUT_DIR=${3:-release}

[ -n "$VERSION" ] || { printf 'usage: %s <version> <arm64|x64> [output-dir]\n' "$0" >&2; exit 2; }
case "$VERSION" in *[!0-9A-Za-z._-]*) printf 'invalid release version: %s\n' "$VERSION" >&2; exit 2 ;; esac
case "$ARCH" in arm64|x64) ;; *) printf 'unsupported release architecture: %s\n' "$ARCH" >&2; exit 2 ;; esac

case "$(uname -m)" in
  arm64) HOST_ARCH=arm64 ;;
  x86_64) HOST_ARCH=x64 ;;
  *) printf 'unsupported build host architecture: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
[ "$HOST_ARCH" = "$ARCH" ] || {
  printf 'release target %s must be built on a native %s host (current: %s)\n' "$ARCH" "$ARCH" "$HOST_ARCH" >&2
  exit 1
}
[ "$(node -p 'process.arch')" = "$ARCH" ] || { printf 'Node runtime architecture does not match %s\n' "$ARCH" >&2; exit 1; }
NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
[ "$NODE_MAJOR" -ge 22 ] || { printf 'Node.js 22 or newer is required for release builds\n' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { printf 'curl is required for the packaged server smoke test\n' >&2; exit 1; }

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUTPUT_DIR=$(mkdir -p "$OUTPUT_DIR" && CDPATH= cd -- "$OUTPUT_DIR" && pwd)
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/ballet-release.XXXXXX")
SMOKE_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/ballet-release-smoke.XXXXXX")
SERVER_PID=

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$STAGE" "$SMOKE_ROOT"
}
trap cleanup EXIT HUP INT TERM

cd "$ROOT"
npm run build

RUNTIME="$STAGE/libexec/ballet"
DEPENDENCIES="$STAGE/.production-dependencies"
mkdir -p "$RUNTIME" "$STAGE/share/ballet" "$DEPENDENCIES"
cp package.json package-lock.json "$DEPENDENCIES/"
(
  cd "$DEPENDENCIES"
  npm ci --omit=dev --no-audit --no-fund
)

NODE_BINARY=$(node -p 'process.execPath')
NODE_ROOT=$(dirname "$(dirname "$NODE_BINARY")")
cp "$NODE_BINARY" "$RUNTIME/node"
chmod 0755 "$RUNTIME/node"
cp "$NODE_ROOT/LICENSE" "$RUNTIME/NODE-LICENSE"
cp package.json "$RUNTIME/package.json"
mv "$DEPENDENCIES/node_modules" "$RUNTIME/node_modules"
cp -R dist-server "$RUNTIME/dist-server"
cp -R dist "$STAGE/share/ballet/dist"
sed "s/{{VERSION}}/$VERSION/g" packaging/ballet-launcher.sh.template > "$STAGE/ballet"
chmod 0755 "$STAGE/ballet"

ARCHIVE="ballet_${VERSION}_darwin_${ARCH}.tar.gz"
ARCHIVE_PATH="$OUTPUT_DIR/$ARCHIVE"
rm -f "$ARCHIVE_PATH"
COPYFILE_DISABLE=1 tar -czf "$ARCHIVE_PATH" -C "$STAGE" ballet libexec share

# Exercise only bytes read back from the final archive, installed through the
# same immutable-bundle + atomic launcher layout used by the curl updater.
EXTRACTED="$SMOKE_ROOT/extracted"
SMOKE_INSTALL="$SMOKE_ROOT/install"
BUNDLE="$SMOKE_INSTALL/libexec/ballet/versions/release-smoke"
mkdir -p "$EXTRACTED" "$SMOKE_INSTALL/bin" "$(dirname "$BUNDLE")"
tar -xzf "$ARCHIVE_PATH" -C "$EXTRACTED"
mv "$EXTRACTED" "$BUNDLE"
ln -s "../libexec/ballet/versions/release-smoke/ballet" "$SMOKE_INSTALL/bin/ballet"
RUNTIME="$BUNDLE/libexec/ballet"

[ -x "$SMOKE_INSTALL/bin/ballet" ]
[ -x "$RUNTIME/node" ]
codesign --verify "$RUNTIME/node"
[ -f "$RUNTIME/node_modules/better-sqlite3/package.json" ]
find "$RUNTIME/node_modules/better-sqlite3" -name '*.node' -type f | grep . >/dev/null
(
  cd "$RUNTIME"
  "$RUNTIME/node" -e 'require("better-sqlite3")'
)
"$SMOKE_INSTALL/bin/ballet" version | grep -Fx "$VERSION" >/dev/null
[ -f "$BUNDLE/share/ballet/dist/index.html" ]

cp -R .fixture-ballet-project "$SMOKE_ROOT/project"
SMOKE_PORT=$(
  "$RUNTIME/node" -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
)
BALLET_HOME="$SMOKE_ROOT/home" \
BALLET_PROJECT_ROOT="$SMOKE_ROOT/project" \
BALLET_PROJECT_ID="release-smoke" \
BALLET_REPOSITORY_URL="file://$SMOKE_ROOT/project" \
PORT="$SMOKE_PORT" \
  "$SMOKE_INSTALL/bin/ballet" server-internal-run >"$SMOKE_ROOT/server.log" 2>"$SMOKE_ROOT/server.err.log" &
SERVER_PID=$!

READY=false
ATTEMPT=0
while [ "$ATTEMPT" -lt 80 ]; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$SMOKE_ROOT/server.err.log" >&2
    printf 'packaged Ballet server exited during smoke test\n' >&2
    exit 1
  fi
  if curl -fsS "http://127.0.0.1:${SMOKE_PORT}/api/health" -o "$SMOKE_ROOT/health.json" 2>/dev/null \
    && "$RUNTIME/node" -e 'const h=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));if(h.ok!==true||h.projectId!=="release-smoke")process.exit(1)' "$SMOKE_ROOT/health.json"; then
    READY=true
    break
  fi
  sleep 0.25
  ATTEMPT=$((ATTEMPT + 1))
done
[ "$READY" = true ] || { cat "$SMOKE_ROOT/server.err.log" >&2; printf 'packaged Ballet server did not become healthy\n' >&2; exit 1; }

UNAUTHORIZED=$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' -d '{}' \
  "http://127.0.0.1:${SMOKE_PORT}/api/daemon/heartbeat")
[ "$UNAUTHORIZED" = 401 ] || { printf 'packaged daemon API smoke expected 401, got %s\n' "$UNAUTHORIZED" >&2; exit 1; }
kill "$SERVER_PID"
wait "$SERVER_PID"
SERVER_PID=

shasum -a 256 "$ARCHIVE_PATH"
