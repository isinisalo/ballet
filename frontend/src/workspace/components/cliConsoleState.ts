import type { CliConsoleEvent } from "./cliConsoleTypes";

export const MAX_CLI_CONSOLE_BYTES = 1024 * 1024;

export const visibleConsoleEvent = (event: CliConsoleEvent): CliConsoleEvent | null => {
  if (event.kind !== "think") return event;
  if (event.data?.raw === true) return null;
  const summary = typeof event.data?.summary === "string" ? event.data.summary : event.message;
  return summary.trim() ? { ...event, message: summary, contentBytes: new TextEncoder().encode(summary).byteLength } : null;
};

export const appendConsoleEvents = (
  current: CliConsoleEvent[],
  incoming: CliConsoleEvent[],
  maxBytes = MAX_CLI_CONSOLE_BYTES
) => {
  const seen = new Set(current.map((entry) => entry.id));
  const accepted = incoming
    .filter((entry) => !seen.has(entry.id))
    .map(visibleConsoleEvent)
    .filter((entry): entry is CliConsoleEvent => Boolean(entry));
  const entries = [...current, ...accepted];
  let bytes = entries.reduce((total, entry) => total + entry.contentBytes, 0);
  let removed = 0;
  while (entries.length > 0 && bytes > maxBytes) {
    bytes -= entries[0].contentBytes;
    entries.shift();
    removed += 1;
  }
  return { entries, truncated: removed > 0 };
};

export const mergeConsoleDeltas = (entries: CliConsoleEvent[]) =>
  entries.reduce<CliConsoleEvent[]>((lines, entry) => {
    const previous = lines.at(-1);
    if (
      entry.phase === "delta"
      && previous?.phase === "delta"
      && previous.itemId === entry.itemId
      && (Boolean(previous.itemId) || entry.kind === "think")
      && previous.kind === entry.kind
    ) {
      lines[lines.length - 1] = {
        ...previous,
        id: entry.id,
        sequence: entry.sequence,
        message: previous.message + entry.message,
        contentBytes: previous.contentBytes + entry.contentBytes,
        terminal: entry.terminal
      };
    } else {
      lines.push(entry);
    }
    return lines;
  }, []);
