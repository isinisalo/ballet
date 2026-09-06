import { Button } from "@/components/ui/button";
import type { StormFileStore } from "./StormFileStore";
export function StormFileFeedback<T>({ file, name }: { file: StormFileStore<T>; name: string }) {
  const state = file.state;
  if (!state.error && !state.conflict) return null;
  return <div className="storm-file-feedback" role="alert"><strong>{name}.json</strong><span>{state.error}</span>
    <Button variant="outline" onClick={() => void file.refresh()}>Refresh {name}</Button>
    {state.dirty && <>
      {!state.conflict && <Button onClick={() => void file.save()}>Retry {name} save</Button>}
      <details><summary>Review local {name} draft</summary>
        <p>Saved hash: <code>{state.baseline?.contentHash}</code><br />Current hash: <code>{state.latest?.contentHash ?? "Unavailable"}</code></p>
        <textarea aria-label={`${name} local draft`} readOnly value={JSON.stringify(state.value, null, 2)} />
        <Button variant="destructive" onClick={() => { if (window.confirm(`Discard local ${name} edits and load the repository file?`)) void file.refresh(true); }}>Discard {name} draft and reload</Button>
      </details>
    </>}
  </div>;
}
