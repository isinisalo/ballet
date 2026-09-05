import { useEffect, useRef, useState } from "react";
import type { ResourceDocument } from "../types";
import { splitMarkdownSource } from "./markdownAuthoring";

/** The baseline hash belongs to the draft, never to the latest background response. */
export function useMarkdownDraft(current: ResourceDocument, onDirty: (dirty: boolean) => void, extraDirty = false) {
  const [baseline, setBaseline] = useState(current);
  const [draft, setDraft] = useState(() => splitMarkdownSource(current.content));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const original = splitMarkdownSource(baseline.content);
  const dirty = extraDirty || draft.frontmatterText !== original.frontmatterText || draft.bodyText !== original.bodyText;
  const stale = current.contentHash !== baseline.contentHash;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  const reload = () => {
    if (dirty && !window.confirm("Discard your edits and load the current file?")) return;
    setBaseline(current); setDraft(splitMarkdownSource(current.content)); setError("");
  };
  const save = async (operation: (hash: string) => Promise<ResourceDocument>) => {
    if (submitting.current || stale) return;
    submitting.current = true; setPending(true); setError("");
    try {
      const saved = await operation(baseline.contentHash);
      setBaseline(saved); setDraft(splitMarkdownSource(saved.content));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save Markdown."); }
    finally { submitting.current = false; setPending(false); }
  };
  return { ...draft, baseline, dirty, stale, pending, error, reload, save,
    setFrontmatterText: (frontmatterText: string) => setDraft((value) => ({ ...value, frontmatterText })),
    setBodyText: (bodyText: string) => setDraft((value) => ({ ...value, bodyText })) };
}
