"use client"

import { Check, ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type MultiSelectOption = { value: string; label: string; detail?: string }

export function MultiSelect({ id, ariaLabel, describedBy, values, options, placeholder = "No items selected", disabled = false, invalid = false, onValuesChange }: {
  id?: string;
  ariaLabel: string;
  describedBy?: string;
  values: string[];
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  onValuesChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [activeIndex, open]);

  const close = () => {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };
  const toggle = (value: string) => onValuesChange(values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value]);
  const move = (next: number) => setActiveIndex(Math.max(0, Math.min(options.length - 1, next)));

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded border border-divider-strong bg-card px-2 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:h-7 md:text-xs"
        onClick={() => {
          const firstSelected = options.findIndex((option) => values.includes(option.value));
          setActiveIndex(firstSelected >= 0 ? firstSelected : 0);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); close(); return }
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
          setActiveIndex(event.key === "ArrowDown" ? 0 : Math.max(0, options.length - 1));
        }}
      >
        <span className={values.length ? "text-foreground" : "text-muted-foreground"}>{values.length ? `${values.length} selected` : placeholder}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10">
          {options.length ? (
            <div role="listbox" aria-label={ariaLabel} aria-multiselectable="true">
              {options.map((option, index) => {
                const selected = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    ref={(element) => { optionRefs.current[index] = element; }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={cn("grid w-full grid-cols-[1rem_minmax(0,1fr)] items-start gap-2 rounded px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus:bg-accent", selected && "text-primary")}
                    onClick={() => toggle(option.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") { event.preventDefault(); close(); return; }
                      if (event.key === "ArrowDown") { event.preventDefault(); move(index + 1); return; }
                      if (event.key === "ArrowUp") { event.preventDefault(); move(index - 1); return; }
                      if (event.key === "Home") { event.preventDefault(); move(0); return; }
                      if (event.key === "End") { event.preventDefault(); move(options.length - 1); return; }
                      if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(option.value); }
                    }}
                  >
                    <span className="flex size-4 items-center justify-center">{selected ? <Check className="size-3.5" /> : null}</span>
                    <span className="min-w-0"><span className="block truncate">{option.label}</span>{option.detail ? <span className="block truncate font-mono text-[0.62rem] text-muted-foreground">{option.detail}</span> : null}</span>
                  </button>
                );
              })}
            </div>
          ) : <p className="px-2 py-3 text-xs text-muted-foreground">No options available.</p>}
        </div>
      ) : null}
    </div>
  );
}
