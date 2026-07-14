import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";

export class LoopThemeService {
  constructor(
    private readonly root: () => string,
    private readonly repository: LoopThemeRepository
  ) {}

  async update(value: unknown): Promise<LoopTheme> {
    return this.repository.update(this.root(), value);
  }
}
