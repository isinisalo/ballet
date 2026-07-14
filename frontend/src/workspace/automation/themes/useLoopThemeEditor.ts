import { useEffect, useMemo, useRef, useState } from "react";
import type { LoopTheme } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import {
  normalizedLoopTheme,
  themeColorPattern,
  themeFingerprint,
  validateLoopThemeDraft,
  withLoopThemeColor,
  type LoopThemeColorKey
} from "./loopThemeEditorState";

export function useLoopThemeEditor({
  source,
  updateTheme,
  forceDirty = false
}: {
  source: LoopTheme;
  updateTheme: (theme: LoopTheme) => Promise<LoopTheme>;
  forceDirty?: boolean;
}) {
  const initial = () => structuredClone(source);
  const [draft, setDraft] = useState<LoopTheme>(initial);
  const [previewTheme, setPreviewTheme] = useState<LoopTheme>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const receivedFingerprintRef = useRef(themeFingerprint(initial()));
  const sourceFingerprint = themeFingerprint(source);

  useEffect(() => {
    const next = structuredClone(source);
    const nextFingerprint = themeFingerprint(next);
    const previousFingerprint = receivedFingerprintRef.current;
    receivedFingerprintRef.current = nextFingerprint;
    setDraft((current) => themeFingerprint(current) === previousFingerprint ? next : current);
    setPreviewTheme((current) => themeFingerprint(current) === previousFingerprint ? next : current);
    setError("");
  }, [sourceFingerprint]);

  const errors = useMemo(() => validateLoopThemeDraft(draft), [draft]);
  const dirty = forceDirty || themeFingerprint(draft) !== receivedFingerprintRef.current;
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
    if (!valid || savingRef.current) return undefined;
    const submittedDraftFingerprint = themeFingerprint(draft);
    const submittedPreviewFingerprint = themeFingerprint(previewTheme);
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await updateTheme(normalizedLoopTheme(draft));
      receivedFingerprintRef.current = themeFingerprint(saved);
      setDraft((current) => themeFingerprint(current) === submittedDraftFingerprint ? saved : current);
      setPreviewTheme((current) => themeFingerprint(current) === submittedPreviewFingerprint ? saved : current);
      return saved;
    } catch (cause) {
      setError(toErrorMessage(cause, "Unable to save Loop theme."));
      return undefined;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return { draft, previewTheme, errors, dirty, valid, saving, error, setDraft: changeTheme, setColor: changeColor, save };
}
