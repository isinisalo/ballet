import { CheckCircle2 } from "lucide-react";

export function WizardStepper({
  steps,
  current = 0
}: {
  steps: string[];
  current?: number;
}) {
  return (
    <ol className="grid gap-2 md:grid-cols-6">
      {steps.map((step, index) => (
        <li key={step} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${index <= current ? "border-primary/40 bg-primary/15 text-primary-foreground" : "border-white/10 bg-black/15 text-muted-foreground"}`}>
          <span className="grid size-5 shrink-0 place-items-center rounded-sm border border-current/20 font-mono text-[0.62rem]">
            {index < current ? <CheckCircle2 className="size-3.5" /> : index + 1}
          </span>
          <span className="truncate font-semibold uppercase">{step}</span>
        </li>
      ))}
    </ol>
  );
}
