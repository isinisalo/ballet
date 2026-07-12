import { loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import { LoopThemeValidationError } from "./LoopThemeErrors.js";

const issuePath = (basePath: string, path: PropertyKey[]): string =>
  path.length === 0 ? basePath : `${basePath}.${path.map(String).join(".")}`;

export const parseLoopTheme = (value: unknown, basePath = "theme"): LoopTheme => {
  const parsed = loopThemeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new LoopThemeValidationError("Loop theme is invalid.", parsed.error.issues.map((issue) => ({
    path: issuePath(basePath, issue.path),
    message: issue.message
  })));
};
