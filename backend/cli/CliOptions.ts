export interface StartOptions {
  codexCommand?: string;
  copilotCommand?: string;
  openBrowser: boolean;
}

export interface LogOptions {
  lines: number;
  follow: boolean;
}

export const parseStartOptions = (args: readonly string[]): StartOptions => {
  const options = parseCliOptions(args, new Set(["codex-command", "copilot-command"]), new Set(["no-open"]));
  return {
    codexCommand: optionalValue(options, "codex-command"),
    copilotCommand: optionalValue(options, "copilot-command"),
    openBrowser: !options.has("no-open")
  };
};

export const parseLogOptions = (args: readonly string[]): LogOptions => {
  const normalized = args.flatMap((value) => value === "-f" ? ["--follow"] : value === "-n" ? ["--lines"] : [value]);
  const options = parseCliOptions(normalized, new Set(["lines"]), new Set(["follow"]));
  const rawLines = options.get("lines") ?? "200";
  const lines = Number(rawLines);
  if (!Number.isSafeInteger(lines) || lines < 1 || lines > 10_000) {
    throw new Error("--lines must be an integer between 1 and 10000.");
  }
  return { lines, follow: options.has("follow") };
};

export const parseCliOptions = (
  args: readonly string[],
  valueOptions = new Set<string>(),
  flagOptions = new Set<string>()
): Map<string, string> => {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const separator = value.indexOf("=");
    const key = value.slice(2, separator < 0 ? undefined : separator);
    const inline = separator < 0 ? undefined : value.slice(separator + 1);
    if (!key || (!valueOptions.has(key) && !flagOptions.has(key))) throw new Error(`Unknown option: --${key || "<empty>"}`);
    if (options.has(key)) throw new Error(`Option --${key} may be provided only once.`);

    if (flagOptions.has(key)) {
      if (inline !== undefined) throw new Error(`Option --${key} does not accept a value.`);
      options.set(key, "true");
      continue;
    }

    const optionValue = inline ?? args[++index];
    if (!optionValue || optionValue.startsWith("--")) throw new Error(`--${key} requires a value.`);
    options.set(key, optionValue);
  }
  return options;
};

const optionalValue = (options: Map<string, string>, key: string): string | undefined => {
  const value = options.get(key)?.trim();
  if (!value) return undefined;
  if (value.includes("/") && !value.startsWith("/")) {
    throw new Error(`--${key} must be a command name or an absolute path.`);
  }
  return value;
};
