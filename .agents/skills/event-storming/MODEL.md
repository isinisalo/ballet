# Event Storming model v1

Canonical file: `.ballet/event-storming/model.md`. It begins with YAML frontmatter bounded by `---`; everything after the closing delimiter is preserved Markdown. The parser and serializer are `backend/orchestration/project/eventStormingMarkdown.ts`; the strict contract is `shared/orchestration/eventStorming.ts`.

The top-level object has exactly `version: 1`, `notes` and `boards`. Every ID is a UUID. Collections serialize sorted by ID; do not encode ordering into array positions.

- Note: `id`, `kind`, `title`, `details`, `sources`. Kinds: `event`, `command`, `actor`, `policy`, `system`, `read-model`, `aggregate`, `hotspot`, `opportunity`, `value`, `definition`, `note`. Sources are HTTP(S) URLs or safe `.ballet/` relative document paths.
- Board: `id`, `title`, `level`, `description`, optional `sourceBoardId`, `placements`, `connections`, `frames`. Levels: `big-picture`, `process-modelling`, `software-design`. A source board must exist at an earlier level.
- Placement: `id`, `noteId`, `x`, `y`, `width`, `height`, `pivotal`, optional `frameId`. The note must exist. The frame, when specified, belongs to the same board. Coordinates are absolute board coordinates, including framed placements. A note may have several placements on one board.
- Connection: `id`, `source`, `target`, `label`. Source and target refer to placement IDs on the same board. Branches and cycles are valid workshop evidence.
- Frame: `id`, `title`, `kind` (`process` or `bounded-context`), `x`, `y`, `width`, `height`.

Changing a note changes its content on every board. Refining a process reuses note IDs and allocates new placement/connection IDs; positions and connections remain independent. Removing a placement removes its incident connections. Removing a frame preserves its notes and removes their frame references. Never delete a shared note to remove only one occurrence.

Preserve stakeholder language and source evidence. Incomplete titles/details and disconnected hotspots are valid drafts. Use reasonable legible geometry: standard notes 184×168, actors 136×112, systems 224×144, with room for connections and parallel flows. Run the strict validator before reporting completion; do not silently repair or migrate an incompatible source file.
