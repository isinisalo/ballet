# Event Storming JSON contracts

Canonical semantic file: `.ballet/event-storming/model.json` (`EventStormingModelV2`). Presentation file: `.ballet/event-storming/layout.json` (`EventStormingLayoutV1`). Both belong to Git. Strict schemas and deterministic serialization live in `shared/orchestration/eventStorming.ts` and `eventStormingLayout.ts`.

Model fields: `version: 2`, `description`, `documentation` (preserved Markdown), `concepts`, `processes`, `sharedConceptIds`.

- Concept: UUID `id`, `kind`, `title`, `details`, `sources`. Kinds are event, command, actor, read-model, policy, system, hotspot, aggregate, opportunity, value, definition and note. Sources are safe `.ballet/` paths or HTTP(S) references.
- Process: UUID `id`, `title`, `description`, `sources`, `storyIds`, `steps`, `connections`, `boundaries`.
- Step: UUID `id`, `conceptId`, `storyIds`, `sources`. The same concept can occur multiple times with distinct step IDs. A reference addresses a whole story UUID, never a criterion array index.
- Connection: UUID `id`, source/target step IDs, `kind` (flow/support/responsibility), `label`, textual `condition`. The source process owns the connection. Explicit cross-process targets are allowed. Branches and cycles are valid.
- Optional boundary: UUID `id`, `title`, `details`, `kind` (responsibility/bounded-context), explicit `stepIds`, `sources`. Visual frame membership has no semantic authority.
- `sharedConceptIds` explicitly identifies project-wide context such as an unresolved workshop question.

Layout contains `version: 1` and `views`. A view has an ID, title, description, presentation kind (overview/process/responsibilities), optional process ID, placements, frames and connection references. Placements keep stable display IDs, one step or concept reference, x/y/width/height, optional frame ID and pivotal marker. Layout arrows reference a semantic connection and their display endpoints. Frames are presentation only. Missing or stale layout gets a temporary display projection; no silent rewrite occurs.

Serialize with the shared `serializeStormJson`: two-space indentation, stable key/ID order and final newline. Arrays in these contracts are sets, not implicit process order. The semantic hash is derived exclusively from the normalized model. No timestamps, runtime statuses or story content/approval copies are stored. Incomplete titles, disconnected events, empty processes and stories with no map link are valid.

Use `ballet context event-storming --json` for an index and `--process <id>` or `--story <id>` for bounded context. This reads checkout-local files offline without starting Ballet. Local sources have content hashes; network references are explicitly not read. Invalid model JSON must be repaired rather than overwritten; layout failure does not block semantic reading.
