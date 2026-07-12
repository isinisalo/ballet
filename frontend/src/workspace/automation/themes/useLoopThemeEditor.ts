import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateLoopThemeResponse, LoopTheme } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import {
  createLoopThemeDraft,
  normalizedLoopTheme,
  themeColorPattern,
  themeFingerprint,
  validateLoopThemeDraft,
  withLoopThemeColor,
  type LoopThemeColorKey
} from "./loopThemeEditorState";

export function useLoopThemeEditor({
  source,
  themes,
  creating,
  assignToLoopId,
  updateTheme,
  createTheme,
  repairMissing = false,
  forceDirty = false
}: {
  source: LoopTheme;
  themes: readonly LoopTheme[];
  creating: boolean;
  assignToLoopId: string;
  updateTheme: (theme: LoopTheme) => Promise<LoopTheme>;
  createTheme: (theme: LoopTheme, loopId: string) => Promise<CreateLoopThemeResponse>;
  repairMissing?: boolean;
  forceDirty?: boolean;
}) {
  const initial = () => creating ? createLoopThemeDraft(source, themes) : structuredClone(source);
  const [draft, setDraft] = useState<LoopTheme>(initial);
  const [previewTheme, setPreviewTheme] = useState<LoopTheme>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const receivedFingerprintRef = useRef(themeFingerprint(initial()));
  const editorKey = `${creating ? "create" : "edit"}:${source.id}:${assignToLoopId}`;
  const editorKeyRef = useRef(editorKey);
  const sourceFingerprint = themeFingerprint(source);
  const themeIdsFingerprint = themes.map((theme) => theme.id).sort().join("\0");

  useEffect(() => {
    const next = creating ? createLoopThemeDraft(source, themes) : structuredClone(source);
    const nextFingerprint = themeFingerprint(next);
    const previousFingerprint = receivedFingerprintRef.current;
    const editorChanged = editorKeyRef.current !== editorKey;
    editorKeyRef.current = editorKey;
    receivedFingerprintRef.current = nextFingerprint;
    setDraft((current) => editorChanged || themeFingerprint(current) === previousFingerprint ? next : current);
    setPreviewTheme((current) => editorChanged || themeFingerprint(current) === previousFingerprint ? next : current);
    setError("");
  }, [creating, editorKey, sourceFingerprint, themeIdsFingerprint]);

  const errors = useMemo(
    () => validateLoopThemeDraft(draft, themes, creating),
    [creating, draft, themes]
  );
  const dirty = creating || forceDirty || themeFingerprint(draft) !== receivedFingerprintRef.current;
  const valid = Object.keys(errors).length === 0;

  const changeTheme = (next: LoopTheme) => {
    setDraft(next);
    setPreviewTheme((current) => ({
      ...next,
      node: {
        ...next.node,
        labelColor: current.node.labelColor,
        glowColor: current.node.glowColor
      },
      edge: {
        ...next.edge,
        color: current.edge.color,
        labelColor: current.edge.labelColor
      },
      connectionPoint: { ...next.connectionPoint, color: current.connectionPoint.color }
    }));
  };
  const changeColor = (key: LoopThemeColorKey, value: string) => {
    setDraft((current) => withLoopThemeColor(current, key, value));
    if (themeColorPattern.test(value)) {
      setPreviewTheme((current) => withLoopThemeColor(current, key, value.toLowerCase()));
    }
  };
  const save = async () => {
    if (!valid || saving) return undefined;
    setSaving(true);
    setError("");
    try {
      const normalized = normalizedLoopTheme(draft);
      const saved = creating || repairMissing
        ? (await createTheme(normalized, assignToLoopId)).theme
        : await updateTheme(normalized);
      receivedFingerprintRef.current = themeFingerprint(saved);
      setDraft(saved);
      setPreviewTheme(saved);
      return saved;
    } catch (cause) {
      setError(toErrorMessage(cause, "Unable to save Loop theme."));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  return { draft, previewTheme, errors, dirty, valid, saving, error, setDraft: changeTheme, setColor: changeColor, save };
}
