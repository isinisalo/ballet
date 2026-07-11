import { Check, Clipboard, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RuntimeBackendTable } from "./RuntimeBackendTable";
import type { PairingSession } from "./types";

export function PairingSessionContent({ session, pending, onApprove, onCheck, onRegenerate, onDone }: {
  session: PairingSession;
  pending: boolean;
  onApprove: () => void;
  onCheck: () => void;
  onRegenerate: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState<"brew" | "curl" | "setup" | "code" | null>(null);
  const copy = async (kind: "brew" | "curl" | "setup" | "code", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1200);
  };

  if (session.status === "expired" || session.status === "revoked") {
    return (
      <div className="grid gap-4 p-4">
        <Alert variant="destructive"><TriangleAlert /><AlertDescription>This pairing session is {session.status}. Create a new one-time code.</AlertDescription></Alert>
        <Button type="button" onClick={onRegenerate}>Create new code</Button>
      </div>
    );
  }

  if (session.status === "claimed") {
    return (
      <div className="grid gap-4 p-4">
        <div className="grid justify-items-center gap-2 py-2 text-center">
          <ShieldCheck className="size-7 text-secondary" />
          <h3 className="text-sm font-semibold">Computer connected</h3>
          <p className="max-w-md text-xs text-muted-foreground">The daemon is paired. CLI readiness remains local to this computer; credentials are never copied into Ballet.</p>
        </div>
        {session.claimedDevice ? <RuntimeBackendTable device={session.claimedDevice} /> : <p className="border border-divider-strong bg-panel-section p-3 text-xs text-muted-foreground">Runtime readiness will appear after the first daemon heartbeat.</p>}
        <div className="flex justify-end"><Button type="button" onClick={onDone}>Open computer</Button></div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4">
      <Progress status={session.status} />
      <CodeBlock label="Install with Homebrew (recommended)" value="brew install isinisalo/tap/ballet" copied={copied === "brew"} onCopy={() => void copy("brew", "brew install isinisalo/tap/ballet")} />
      <CodeBlock label="Or install the same verified release with curl" value="curl --proto '=https' --tlsv1.2 -fsSL https://raw.githubusercontent.com/isinisalo/ballet/main/scripts/install.sh | sh" copied={copied === "curl"} onCopy={() => void copy("curl", "curl --proto '=https' --tlsv1.2 -fsSL https://raw.githubusercontent.com/isinisalo/ballet/main/scripts/install.sh | sh")} />
      {session.installCommand ? (
        <CodeBlock label="Pair and start the daemon" value={session.installCommand} copied={copied === "setup"} onCopy={() => void copy("setup", session.installCommand!)} />
      ) : (
        <Alert><AlertDescription>Install the Ballet daemon package on the target Mac, then enter the one-time device code shown below when prompted.</AlertDescription></Alert>
      )}
      <CodeBlock label="One-time device code" value={session.userCode || session.deviceCode} copied={copied === "code"} onCopy={() => void copy("code", session.userCode || session.deviceCode)} />
      <p className="font-mono text-[0.62rem] text-muted-foreground">Expires {new Date(session.expiresAt).toLocaleString()} · Session {session.id}</p>
      {session.status === "pending" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-tertiary/30 bg-tertiary/5 p-3">
          <p className="text-xs text-tertiary">Verify the displayed code, then approve this one-time pairing session.</p>
          <Button type="button" disabled={pending} onClick={onApprove}><ShieldCheck /> {pending ? "Approving…" : "Approve one-time code"}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin text-tertiary" /> Approved. Waiting for the daemon to claim this code…</span><Button type="button" size="xs" variant="outline" disabled={pending} onClick={onCheck}>Check now</Button></div>
      )}
    </div>
  );
}

function Progress({ status }: { status: PairingSession["status"] }) {
  const current = status === "claimed" ? 2 : status === "approved" ? 1 : 0;
  return (
    <ol className="grid grid-cols-3 gap-2 font-mono text-[0.6rem] uppercase tracking-[0.04em] text-muted-foreground">
      {["Install", "Verify device", "Readiness"].map((label, index) => <li key={label} className={index <= current ? "border-b-2 border-primary pb-1 text-foreground" : "border-b border-divider-strong pb-1"}>{index + 1}. {label}</li>)}
    </ol>
  );
}

function CodeBlock({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex min-w-0 items-start gap-2 border border-divider-strong bg-background p-2.5">
        <code className="min-w-0 flex-1 break-all font-mono text-[0.7rem] text-foreground">{value}</code>
        <Button type="button" size="icon-xs" variant="ghost" aria-label={`Copy ${label.toLowerCase()}`} onClick={onCopy}>{copied ? <Check /> : <Clipboard />}</Button>
      </div>
    </div>
  );
}
