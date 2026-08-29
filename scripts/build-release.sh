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
[ "$HOST_ARCH" = "$ARCH" ] || { printf 'release target %s must use a native %s host\n' "$ARCH" "$ARCH" >&2; exit 1; }
[ "$(node -p 'process.arch')" = "$ARCH" ] || { printf 'Node runtime architecture does not match %s\n' "$ARCH" >&2; exit 1; }
[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 22 ] || { printf 'Node.js 22 or newer is required\n' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { printf 'curl is required for the packaged smoke test\n' >&2; exit 1; }

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
(cd "$RUNTIME" && "$RUNTIME/node" -e 'require("better-sqlite3")')
"$SMOKE_INSTALL/bin/ballet" version | grep -Fx "$VERSION" >/dev/null
[ -f "$BUNDLE/share/ballet/dist/index.html" ]

cp -R .fixture-ballet-project "$SMOKE_ROOT/project"
(
  cd "$SMOKE_ROOT/project"
  git init -b main >/dev/null
  git config user.email ballet-release@example.test
  git config user.name "Ballet release smoke"
  git add .
  git commit -m "Release smoke fixture" >/dev/null
)
mkdir -p "$SMOKE_ROOT/home"
SMOKE_PORT=$("$RUNTIME/node" -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
(cd "$SMOKE_ROOT/project" && \
  exec env HOME="$SMOKE_ROOT/home" "$SMOKE_INSTALL/bin/ballet" server-internal-run \
    --root "$SMOKE_ROOT/project" --port "$SMOKE_PORT" \
    --state-root "$SMOKE_ROOT/project/.git/ballet") \
  >"$SMOKE_ROOT/server.log" 2>"$SMOKE_ROOT/server.err.log" &
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
    && "$RUNTIME/node" -e 'const fs=require("node:fs");const h=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(h.ok!==true||fs.realpathSync(h.checkoutRoot)!==fs.realpathSync(process.argv[2])||h.port!==Number(process.argv[3]))process.exit(1)' "$SMOKE_ROOT/health.json" "$SMOKE_ROOT/project" "$SMOKE_PORT"; then
    READY=true
    break
  fi
  sleep 0.25
  ATTEMPT=$((ATTEMPT + 1))
done
[ "$READY" = true ] || { cat "$SMOKE_ROOT/server.err.log" >&2; printf 'packaged Ballet server did not become healthy\n' >&2; exit 1; }

curl -fsS "http://127.0.0.1:${SMOKE_PORT}/api/project" -o "$SMOKE_ROOT/project.json"
curl -fsS "http://127.0.0.1:${SMOKE_PORT}/api/environment" -o "$SMOKE_ROOT/environment.json"
"$RUNTIME/node" -e '
const fs = require("node:fs");
const project = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const environment = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (project.config?.version !== 21
  || project.config?.environment?.id !== "fixture-environment"
  || project.config?.direction?.useCases?.[0]?.status !== "approved"
  || environment.environment?.id !== "fixture-environment"
  || environment.environment?.states?.[0]?.order !== 1
  || environment.environment?.states?.[0]?.actions?.[0]?.priority !== 1) {
  throw new Error("packaged Ballet server did not load the canonical fixture workspace");
}
' "$SMOKE_ROOT/project.json" "$SMOKE_ROOT/environment.json"

[ -f "$SMOKE_ROOT/project/.git/ballet/state.sqlite" ] || { printf 'packaged Ballet server did not create state.sqlite\n' >&2; exit 1; }
"$RUNTIME/node" -e '
const Database = require("better-sqlite3");
const database = new Database(process.argv[1], { readonly: true });
const version = database.prepare("SELECT value FROM metadata WHERE key = ?").get("schema_version")?.value;
database.close();
if (version !== "17") throw new Error(`packaged Ballet created SQLite schema ${version ?? "unknown"}, expected 17`);
' "$SMOKE_ROOT/project/.git/ballet/state.sqlite"
[ -z "$(git -C "$SMOKE_ROOT/project" status --porcelain)" ] || { git -C "$SMOKE_ROOT/project" status --short >&2; exit 1; }
[ -z "$(find "$SMOKE_ROOT/home" -mindepth 1 -print -quit)" ] || { printf 'packaged Ballet wrote mutable state outside the checkout\n' >&2; exit 1; }
kill "$SERVER_PID"
wait "$SERVER_PID"
SERVER_PID=

shasum -a 256 "$ARCHIVE_PATH"
