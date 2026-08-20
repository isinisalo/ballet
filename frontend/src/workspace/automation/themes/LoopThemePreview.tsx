import type { LoopTheme } from "@shared/api/workspace-contracts";
import { LoopCanvas } from "../loops/LoopCanvas";
import { LoopArtworkGallery } from "./LoopArtworkGallery";
import { previewConfig, previewExecutionProfiles, previewLoop } from "./loopThemePreviewModel";

export function LoopThemePreview({ theme }: { theme: LoopTheme }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
      <LoopArtworkGallery theme={theme} />
      <div className="h-[360px] overflow-hidden"><LoopCanvas config={previewConfig} loop={previewLoop} executionProfiles={previewExecutionProfiles} theme={theme} readOnly /></div>
    </div>
  );
}
