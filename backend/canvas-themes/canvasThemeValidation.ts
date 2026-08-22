import { canvasThemeSchema } from "../../shared/api/workspace-schemas.js";
import type { CanvasTheme } from "../../shared/domain/canvasTheme.js";
import { CanvasThemeValidationError } from "./CanvasThemeErrors.js";

const issuePath = (basePath: string, path: PropertyKey[]): string =>
  path.length === 0 ? basePath : `${basePath}.${path.map(String).join(".")}`;

export const parseCanvasTheme = (value: unknown, basePath = "theme"): CanvasTheme => {
  const parsed = canvasThemeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new CanvasThemeValidationError("Canvas theme is invalid.", parsed.error.issues.map((issue) => ({
    path: issuePath(basePath, issue.path),
    message: issue.message
  })));
};
