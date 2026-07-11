import { useState } from "react";
import { Play } from "lucide-react";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";

export function LoopRunStartPanel({
  disabledReason,
  pending,
  onStart
}: {
  disabledReason?: string;
  pending: boolean;
  onStart: (input: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");

  const start = async () => {
    if (await onStart(input)) setInput("");
  };

  return (
    <section className="grid gap-3 border-t border-divider-strong bg-card p-4" aria-label="Start loop run">
      <TextAreaField label="Manual input (optional)" value={input} rows={3} disabled={pending || Boolean(disabledReason)} onChange={setInput} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{disabledReason ?? "Starts a new manual run from this loop's saved start step."}</p>
        <Button type="button" disabled={pending || Boolean(disabledReason)} onClick={() => void start()}>
          <Play /> {pending ? "Starting…" : "Start"}
        </Button>
      </div>
    </section>
  );
}
