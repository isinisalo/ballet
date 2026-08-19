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
(
  cd "$SMOKE_ROOT/project"
  git init -b main >/dev/null
  git config user.email ballet-release@example.test
  git config user.name "Ballet release smoke"
  git add .
  git commit -m "Release smoke fixture" >/dev/null
)
mkdir -p "$SMOKE_ROOT/home"
SMOKE_PORT=$(
  "$RUNTIME/node" -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
)
(cd "$SMOKE_ROOT/project" && \
  exec env HOME="$SMOKE_ROOT/home" "$SMOKE_INSTALL/bin/ballet" server-internal-run \
    --root "$SMOKE_ROOT/project" \
    --port "$SMOKE_PORT" \
    --state-root "$SMOKE_ROOT/project/.git/ballet" \
    --codex-command "$SMOKE_ROOT/providers/missing-codex" \
    --copilot-command "$SMOKE_ROOT/providers/missing-copilot") \
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
    && "$RUNTIME/node" -e 'const fs=require("node:fs");const h=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(h.ok!==true||fs.realpathSync(h.checkoutRoot)!==fs.realpathSync(process.argv[2])||h.port!==Number(process.argv[3])||typeof h.instanceId!=="string")process.exit(1)' "$SMOKE_ROOT/health.json" "$SMOKE_ROOT/project" "$SMOKE_PORT"; then
    READY=true
    break
  fi
  sleep 0.25
  ATTEMPT=$((ATTEMPT + 1))
done
[ "$READY" = true ] || { cat "$SMOKE_ROOT/server.err.log" >&2; printf 'packaged Ballet server did not become healthy\n' >&2; exit 1; }

curl -fsS "http://127.0.0.1:${SMOKE_PORT}/api/data" -o "$SMOKE_ROOT/workspace.json" || {
  cat "$SMOKE_ROOT/server.err.log" >&2
  printf 'packaged Ballet server could not load the fixture workspace\n' >&2
  exit 1
}
curl -fsS "http://127.0.0.1:${SMOKE_PORT}/api/loop-modules/library" -o "$SMOKE_ROOT/loop-library.json" || {
  cat "$SMOKE_ROOT/server.err.log" >&2
  printf 'packaged Ballet server could not list the fixture Loop Library\n' >&2
  exit 1
}
"$RUNTIME/node" -e '
const fs = require("node:fs");
const entries = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!Array.isArray(entries)
  || entries.length !== 1
  || entries[0]?.source !== ".ballet/loop-library/fixture-clarify.ballet-loop.json"
  || entries[0]?.valid !== true
  || entries[0]?.manifest?.title !== "Clarify requirements"
  || entries[0]?.permissions?.externalWrites !== false
  || entries[0]?.package?.capabilities?.accepts?.[0] !== "arc42:initiative.requested"
  || entries[0]?.package?.capabilities?.provides?.[0] !== "arc42:requirements.clarified"
  || entries[0]?.package?.loop?.nodes?.length !== 2) {
  throw new Error("packaged Ballet server did not list the fixture Loop Library package");
}
' "$SMOKE_ROOT/loop-library.json"
"$RUNTIME/node" -e '
const fs = require("node:fs");
const workspace = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const expectedProfile = {
  id: "codex-gpt-5-6-luna-high-network-off",
  name: "Codex GPT-5.6 Luna · High · Network off",
  provider: "codex",
  model: "gpt-5.6-luna",
  reasoningEffort: "high",
  networkAccess: false
};
const loop = workspace.automation?.loops?.[0];
const workLoopNode = loop?.nodes?.find((node) => node.id === "review");
const architect = workspace.instructions?.find((item) => item.id === "project:architect");
const reviewer = workspace.instructions?.find((item) => item.id === "project:reviewer");
if (workspace.automation?.version !== 11
  || workspace.automation.loops.length !== 1
  || loop?.id !== "adr-review"
  || loop?.description !== "Review a project change and validate the review result."
  || loop?.capabilities?.accepts?.[0] !== "ballet:task.requested"
  || loop?.capabilities?.provides?.[0] !== "ballet:task.completed"
  || !Array.isArray(workspace.automation.graph?.loopEdges)
  || workspace.automation.graph.loopEdges.length !== 0
  || loop?.startNodeId !== "review"
  || loop?.state?.description !== "Provider-neutral context shared by the review Work Loop."
  || JSON.stringify(loop?.state?.initial) !== "{}"
  || JSON.stringify(workspace.executionProfiles) !== JSON.stringify([expectedProfile])
  || workspace.automation.orchestrator?.executionProfileId !== expectedProfile.id
  || workspace.automation.orchestrator?.primaryInstructionId !== "project:architect"
  || workLoopNode?.description !== "Run and validate the project review."
  || workLoopNode?.work?.type !== "agent"
  || workLoopNode?.work?.task !== "Review the project changes and surface concrete risks."
  || workLoopNode?.work?.executionProfileId !== expectedProfile.id
  || workLoopNode?.work?.primaryInstructionId !== "project:reviewer"
  || !Array.isArray(workLoopNode?.work?.skillIds)
  || workLoopNode.work.skillIds.length !== 0
  || workLoopNode?.validation?.type !== "agent"
  || workLoopNode?.validation?.task !== "Confirm that the review is complete and actionable."
  || workLoopNode?.maxLocalAttempts !== 3
  || loop?.edges?.[0]?.source !== "review"
  || loop?.edges?.[0]?.target?.terminal !== "completed"
  || Object.hasOwn(workLoopNode, "state")
  || workspace.instructions?.length !== 2
  || architect?.valid !== true
  || architect?.relativePath !== ".ballet/instructions/architect.md"
  || architect?.body !== "## Instructions\n\nDesign architecture, keep decisions traceable, and write ADRs when routing requires it.\n"
  || architect?.sourceSha256 !== "e14626fb277d87f010307476613b89b0aa8bbb0f6903a10127f4f8e23082b44b"
  || architect?.contentSha256 !== "3a7b394727be306a4dad011a4152d1502f35da591a406a74281362d9cd19b78d"
  || architect?.sizeBytes !== 105
  || reviewer?.valid !== true
  || reviewer?.relativePath !== ".ballet/instructions/reviewer.md"
  || reviewer?.body !== "Review implementation changes and surface risks.\n"
  || reviewer?.sourceSha256 !== "4e43b53837175e6ac6b1b666b96de045cf2cb37b9f6cda2868e1207dd9ac6df6"
  || reviewer?.contentSha256 !== "8ce7d15bdcd9cd6e2e4ec3471343e96ee50d1c18bc19aae62a8941f6dfc8ee9a"
  || reviewer?.sizeBytes !== 49
  || workspace.resourceIssues?.length !== 0
  || workspace.automationIssues?.length !== 0
  || workspace.loopTheme?.version !== 4
  || Object.hasOwn(workspace.loopTheme?.node ?? {}, "showAgentAvatarInNode")
  || workspace.loopThemeIssues?.length !== 0) {
  throw new Error("packaged Ballet server did not load the strict v11 fixture workspace");
}
' "$SMOKE_ROOT/workspace.json" || {
  cat "$SMOKE_ROOT/server.err.log" >&2
  exit 1
}

[ -f "$SMOKE_ROOT/project/.git/ballet/state.sqlite" ] || {
  printf 'packaged Ballet server did not create checkout-local state.sqlite\n' >&2
  exit 1
}
[ -z "$(git -C "$SMOKE_ROOT/project" status --porcelain)" ] || {
  git -C "$SMOKE_ROOT/project" status --short >&2
  printf 'packaged Ballet server dirtied the fixture checkout\n' >&2
  exit 1
}
[ -z "$(find "$SMOKE_ROOT/home" -mindepth 1 -print -quit)" ] || {
  printf 'packaged Ballet server wrote mutable state outside the checkout\n' >&2
  exit 1
}
kill "$SERVER_PID"
wait "$SERVER_PID"
SERVER_PID=

shasum -a 256 "$ARCHIVE_PATH"
