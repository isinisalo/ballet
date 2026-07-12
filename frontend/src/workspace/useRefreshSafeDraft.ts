import { useCallback, useEffect, useRef, useState } from "react";

const fingerprint = (value: unknown) => JSON.stringify(value);

export function useRefreshSafeDraft<T>(source: T, identity: string) {
  const sourceFingerprint = fingerprint(source);
  const sourceRef = useRef(source);
  const identityRef = useRef(identity);
  const receivedFingerprintRef = useRef(sourceFingerprint);
  const [draft, setDraft] = useState(source);
  sourceRef.current = source;

  useEffect(() => {
    const identityChanged = identityRef.current !== identity;
    const previousFingerprint = receivedFingerprintRef.current;
    identityRef.current = identity;
    receivedFingerprintRef.current = sourceFingerprint;
    setDraft((current) => identityChanged || fingerprint(current) === previousFingerprint ? sourceRef.current : current);
  }, [identity, sourceFingerprint]);

  const accept = useCallback((accepted: T) => {
    receivedFingerprintRef.current = fingerprint(accepted);
    setDraft(accepted);
  }, []);

  return {
    draft,
    setDraft,
    accept,
    dirty: fingerprint(draft) !== receivedFingerprintRef.current
  };
}
