import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function VNextFrame({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <SidebarProvider>
      {sidebar}
      <div data-slot="sidebar-inset" className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <ScrollArea className="h-svh min-w-0">
          <main className="vnext-workspace flex min-h-svh min-w-0 flex-col overflow-x-hidden bg-background">
            <header className="flex p-3 pb-0 md:hidden"><SidebarTrigger aria-label="Open navigation"><Menu /></SidebarTrigger></header>
            {children}
          </main>
        </ScrollArea>
      </div>
    </SidebarProvider>
  );
}
