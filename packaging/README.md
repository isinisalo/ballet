# Ballet CLI release contract

Each macOS archive is built on a native runner for its target architecture. It contains the `ballet` launcher, bundled Node runtime, compiled local server and CLI, production dependencies (including native `better-sqlite3`), and the frontend:

```text
ballet
libexec/ballet/node
libexec/ballet/package.json
libexec/ballet/dist-server/**
libexec/ballet/node_modules/**
share/ballet/dist/**
```

The launcher resolves its installation prefix, exports the packaged executable and web asset locations, and dispatches the CLI through bundled Node. The private `server-internal-run` entrypoint uses the same runtime and dependency tree; there is no daemon entrypoint or second process.

`scripts/build-release.sh` refuses cross-architecture builds. It builds the final archive, extracts those exact bytes into the direct-install layout, loads `better-sqlite3`, creates a committed fixture checkout, and starts the packaged server against that checkout. The smoke test verifies checkout-aware health, `.git/ballet/state.sqlite`, a clean Git status, and graceful SIGTERM shutdown before emitting the archive checksum.

Each release publishes arm64 and x64 archives, `checksums.txt`, a generated Homebrew Formula, and GitHub Artifact Attestations. The curl installer and `ballet update` verify SHA-256 and attestation before activation.

A direct install expands the complete archive into one immutable versioned bundle. The canonical executable is a stable symlink:

```text
<prefix>/bin/ballet
  -> ../libexec/ballet/versions/<bundle-id>/ballet
```

After validating the staged launcher, runtime architecture, native dependency, and CLI version, the installer creates a replacement symlink beside `<prefix>/bin/ballet` and activates it with a same-filesystem atomic rename. Existing processes keep their original bundle while new launchd starts resolve the new target.

Homebrew installs the same archive into its versioned Cellar layout. `ballet update` delegates to Homebrew when the active executable belongs to its Ballet prefix.

All mutable application state lives in the active checkout's `.git/ballet` directory. The uniquely named checkout plist under `~/Library/LaunchAgents` is the only project-specific Ballet artifact outside the Git directory.
