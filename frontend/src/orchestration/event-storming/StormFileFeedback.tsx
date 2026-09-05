import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { useStormDocument } from "./useStormDocument";

export function StormFileFeedback({ document }: { document: ReturnType<typeof useStormDocument> }) {
  const [open, setOpen] = useState(false); const [copyResult, setCopyResult] = useState("");
  if (!document.error && !document.conflict) return null;
  return <div className="storm-file-feedback" role="alert"><span>{document.error}</span>
    <Button variant="outline" onClick={document.refresh}>Refresh file</Button>
    {document.dirty && <Button variant="outline" onClick={() => setOpen(true)}>Review local draft</Button>}
    {!document.conflict && document.dirty && <Button onClick={() => { void document.store.save(); }}>Retry save</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="storm-dialog storm-conflict-dialog">
      <DialogHeader><DialogTitle>Repository file and local draft</DialogTitle><DialogDescription>Your draft is kept until you explicitly load the current file.</DialogDescription></DialogHeader>
      <p className="storm-hash">Saved hash: {document.baseline?.contentHash}<br />Current hash: {document.latest?.contentHash ?? "Refresh to check"}</p>
      <div className="storm-conflict-columns"><label>Repository<textarea readOnly value={JSON.stringify((document.latest ?? document.baseline)?.value, null, 2)} /></label><label>Local draft<textarea readOnly value={JSON.stringify(document.value, null, 2)} /></label></div>
      <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`---\n${JSON.stringify(document.value, null, 2)}\n---\n${document.baseline?.body ?? ""}`); setCopyResult("Draft copied. Resolve any validation errors before using it as model.md."); } catch { setCopyResult("Clipboard unavailable. Select and copy the local draft above."); } }}>Copy model.md draft</Button>
      <span role="status">{copyResult}</span>
      <Button variant="destructive" onClick={() => { if (window.confirm("Discard this local draft and load the current repository file?")) { void document.store.refresh(true); setOpen(false); } }}>Discard draft and reload file</Button>
    </DialogContent></Dialog>
  </div>;
}
