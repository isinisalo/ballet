import type { CanvasTheme } from "../../shared/domain/canvasTheme.js";
import type { CanvasThemeRepository } from "../canvas-themes/CanvasThemeRepository.js";

export class CanvasThemeService {
  constructor(
    private readonly root: () => string,
    private readonly repository: CanvasThemeRepository
  ) {}

  async update(value: unknown): Promise<CanvasTheme> {
    return this.repository.update(this.root(), value);
  }
}
