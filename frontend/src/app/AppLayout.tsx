import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { AppSidebar, SidebarProvider } from "./AppSidebar";
import type { RouteState } from "./routes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout({
  route,
  navigate,
  children
}: {
  route: RouteState;
  navigate: (path: string) => void;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar route={route} navigate={navigate} />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <main className="min-h-svh bg-muted/30 p-3 md:p-5">
              <div className="mb-4 flex items-center md:hidden">
                <SidebarTrigger>
                  <Menu className="size-4" />
                </SidebarTrigger>
              </div>
              <div className="mx-auto grid w-full max-w-7xl gap-5">
                {children}
              </div>
            </main>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
