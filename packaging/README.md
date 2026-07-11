# Ballet CLI release contract

Each macOS archive is built on a native runner for its target architecture. It contains a small `ballet` launcher plus a bundled Node runtime, compiled server JavaScript, production dependencies (including the native `better-sqlite3` addon), and the frontend:

```text
ballet
libexec/ballet/node
libexec/ballet/package.json
libexec/ballet/dist-server/**
libexec/ballet/node_modules/**
share/ballet/dist/**
```

The launcher resolves its installation prefix, exports the packaged executable and web asset locations, then dispatches the CLI through `libexec/ballet/node`. The existing private `daemon-internal-run` and `server-internal-run` arguments therefore use the same bundled runtime and production dependency tree.

`scripts/build-release.sh` refuses cross-architecture builds. It creates the archive, extracts those final bytes into the direct-install layout, loads `better-sqlite3`, starts the packaged `server-internal-run`, verifies the project-aware health endpoint, and verifies that an unauthenticated daemon API request returns 401. The script emits the archive checksum only after those checks, making native module and server startup failures release-blocking.

Each release publishes arm64 and x64 archives, `checksums.txt`, a generated Homebrew Formula, and GitHub Artifact Attestations. The curl installer and `ballet update` verify both SHA256 and the attestation before activating any downloaded bytes.

A direct install expands the complete archive into one immutable, versioned bundle. The canonical executable is a stable symlink:

```text
<prefix>/bin/ballet
  -> ../libexec/ballet/versions/<bundle-id>/ballet

<prefix>/libexec/ballet/versions/<bundle-id>/
  ballet
  libexec/ballet/**
  share/ballet/**
```

`<bundle-id>` is version- and checksum-derived and has a unique suffix, so an update never writes into the active bundle. After validating the staged bundle's launcher, runtime architecture, and CLI version, the installer or updater creates a replacement symlink beside `<prefix>/bin/ballet` and activates it with a same-filesystem atomic rename. The release build and in-place updater additionally load the packaged native dependency before activation. Existing processes can finish against their original bundle while new invocations resolve the new target. Previous bundles are left untouched by activation.

Homebrew installs the archive contents into its own versioned Cellar layout with `brew install isinisalo/tap/ballet`; `ballet update` delegates activation to `brew upgrade ballet` after verifying the release archive and then confirms the installed version.

Mutable state stays under `~/.ballet`. Daemon and server logs stay under `~/Library/Logs/Ballet` unless `BALLET_LOG_DIR` is explicitly configured.
