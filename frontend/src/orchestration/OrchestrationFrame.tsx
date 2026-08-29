import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function OrchestrationFrame({ sidebar, children, streamStatus }: { sidebar: ReactNode; children: ReactNode; streamStatus: "connecting" | "live" | "retrying" }) {
  return (
    <SidebarProvider>
      {sidebar}
      <div data-slot="sidebar-inset" className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <ScrollArea className="h-svh min-w-0">
          <main className="orchestration-workspace flex min-h-svh min-w-0 flex-col bg-background">
            <header className="flex items-center justify-between gap-2 p-3 pb-0"><SidebarTrigger className="min-h-10 min-w-10 md:hidden" aria-label="Open navigation" /><span role="status" aria-live="polite" className="ml-auto font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">Events · {streamStatus}</span></header>
            {children}
          </main>
        </ScrollArea>
      </div>
    </SidebarProvider>
  );
}
