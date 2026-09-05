import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { UserStoryDocument } from "@shared/orchestration/userStories";
import type { useUserStoryDraft } from "./useUserStoryDraft";

export function UserStoryEditorFeedback({ editor, current, disabled, onRefresh }: {
  editor: ReturnType<typeof useUserStoryDraft>; current?: UserStoryDocument; disabled: boolean; onRefresh(): Promise<void>;
}) {
  return <>
    {editor.error ? <Alert variant="destructive" className="mb-4"><AlertDescription>{editor.error}{editor.conflict ? <Button size="sm" variant="outline" className="mt-2" onClick={() => void onRefresh()}>Check current file</Button> : null}</AlertDescription></Alert> : null}
    {editor.stale ? <Alert className="mb-4"><AlertDescription>The file changed. Your edits are preserved. Review the current file before saving.
      <code className="my-2 block break-all text-xs">Current hash: {current?.contentHash ?? "File unavailable"}</code>
      <Button size="sm" variant="outline" disabled={!current || disabled} onClick={editor.reset}>Reload current file</Button>
    </AlertDescription></Alert> : null}
  </>;
}
