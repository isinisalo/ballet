import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkbenchLayout({ preview, editor, className }: { preview: ReactNode; editor: ReactNode; className?: string }) {
  return (
    <div className={cn("@container/workbench", className)}>
      <div className="grid gap-0 @2xl/workbench:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        {preview}
        <div className="border-t border-divider-strong @2xl/workbench:border-l @2xl/workbench:border-t-0">
          {editor}
        </div>
      </div>
    </div>
  );
}
