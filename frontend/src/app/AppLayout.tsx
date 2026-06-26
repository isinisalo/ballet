import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { AppSidebar, SidebarProvider } from "./AppSidebar";
import { TopBar } from "./TopBar";
import type { RouteState } from "./routes";
import type { AppData } from "backend/shared/domain";
import type { FlowViewModel } from "backend/shared/flow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout({
  route,
  data,
  flows,
  navigate,
  children
}: {
  route: RouteState;
  data: AppData;
  flows: FlowViewModel[];
  navigate: (path: string) => void;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar route={route} navigate={navigate} />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <TopBar data={data} flows={flows} navigate={navigate} />
            <main className="min-h-svh p-3 md:p-5">
              <div className="mb-3 flex items-center md:hidden">
                <SidebarTrigger className="border border-white/10 bg-card/80">
                  <Menu className="size-4" />
                </SidebarTrigger>
              </div>
              <div className="mx-auto grid w-full max-w-[92rem] gap-5">
                {children}
              </div>
            </main>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
