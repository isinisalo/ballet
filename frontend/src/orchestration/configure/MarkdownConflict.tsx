import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function MarkdownConflict({ stale, hash, onReload }: { stale: boolean; hash: string; onReload(): void }) {
  if (!stale) return null;
  return <Alert className="m-4 w-auto"><AlertDescription>
    The repository file changed. Your draft is preserved. Current hash <code className="break-all">{hash}</code>.
    <Button className="mt-2 min-h-10" variant="outline" onClick={onReload}>Reload current file</Button>
  </AlertDescription></Alert>;
}
