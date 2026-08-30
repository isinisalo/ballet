import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function SkillBadgePicker({ role, values, options, disabled, onValuesChange }: {
  role: "validation" | "work";
  values: string[];
  options: string[];
  disabled: boolean;
  onValuesChange(values: string[]): void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const available = options.filter((option) => !values.includes(option));
  const addDisabled = disabled || available.length === 0;
  const close = () => { setOpen(false); queueMicrotask(() => triggerRef.current?.focus()); };

  useEffect(() => {
    if (!open) return;
    firstOptionRef.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div className="grid gap-1 text-xs md:grid-cols-[9rem_minmax(0,1fr)] md:items-start">
    <span className="min-h-8 py-1 text-muted-foreground">Skills</span>
    <div ref={rootRef} className="relative flex min-h-10 min-w-0 flex-wrap items-center gap-1.5 md:min-h-8" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      {values.map((skill) => <Badge key={skill} variant="outline" render={<button type="button" disabled={disabled} />}
        className="min-h-10 max-w-full cursor-pointer px-2 font-mono focus-visible:outline-none md:min-h-6"
        aria-label={`Remove ${skill} from ${role} Skills`} onClick={() => onValuesChange(values.filter((candidate) => candidate !== skill))}>
        <span className="truncate">{skill}</span><X aria-hidden="true" />
      </Badge>)}
      <Badge variant="ghost" render={<button ref={triggerRef} type="button" disabled={addDisabled} />} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`Add ${role} Skill`} className="min-h-10 cursor-pointer px-2 text-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:min-h-6"
        onClick={() => setOpen((current) => !current)}>
        <Plus aria-hidden="true" />Skill
      </Badge>
      {open ? <div role="listbox" aria-label={`Available ${role} Skills`} className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-md bg-popover p-1 shadow-md ring-1 ring-foreground/10">
        {available.map((skill, index) => <button key={skill} ref={index === 0 ? firstOptionRef : undefined} type="button" role="option" aria-selected="false"
          className="flex min-h-10 w-full items-center gap-2 rounded-sm px-2 text-left font-mono text-xs outline-none hover:bg-accent focus:bg-accent md:min-h-8"
          onClick={() => { onValuesChange([...values, skill].sort()); close(); }} onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); close(); }
          }}>
          <Check className="size-3 opacity-0" aria-hidden="true" />{skill}
        </button>)}
      </div> : null}
    </div>
  </div>;
}
