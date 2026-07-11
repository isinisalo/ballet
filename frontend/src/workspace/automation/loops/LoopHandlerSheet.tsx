import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoopHandlerSheet({
  open,
  title,
  header,
  left,
  right,
  onOpenChange
}: {
  open: boolean;
  title: string;
  header?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  useLoopHandlerEscapeClose(open, onOpenChange);
  if (!open) return null;

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] md:hidden" />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 flex h-svh w-full min-w-0 flex-col overflow-hidden border-l border-divider-strong bg-popover text-sm text-popover-foreground shadow-lg md:static md:z-auto md:h-auto md:min-h-0 md:w-auto md:shadow-none"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Close" className="absolute top-1.5 right-1.5 z-20" onClick={() => onOpenChange(false)}>
          <X />
        </Button>
        {header ? <div className="shrink-0 border-b border-divider-strong bg-panel-section pr-10">{header}</div> : null}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-[3fr_2fr] sm:overflow-hidden">
          {left}
          {right}
        </div>
      </aside>
    </>
  );
}

function useLoopHandlerEscapeClose(open: boolean, onOpenChange: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);
}
