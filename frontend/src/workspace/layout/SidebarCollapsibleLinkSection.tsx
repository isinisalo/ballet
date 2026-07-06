import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

export function SidebarCollapsibleLinkSection({
  label,
  icon,
  path,
  active,
  children,
  navigate,
  groupClassName = "group/sidebar-link-section",
  chevronClassName = "group-data-[state=open]/sidebar-link-section:rotate-90"
}: {
  label: string;
  icon: ReactNode;
  path: string;
  active: boolean;
  children: ReactNode;
  navigate: (path: string) => void;
  groupClassName?: string;
  chevronClassName?: string;
}) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={groupClassName}>
      <SidebarNavLinkItem
        path={path}
        isActive={active}
        navigate={navigate}
        ariaExpanded={open}
        className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
        onNavigate={() => {
          setOpen((current) => !current);
        }}
        after={(
          <CollapsibleContent>
            {children}
          </CollapsibleContent>
        )}
      >
        {icon}
        <span>{label}</span>
        <ChevronRight className={cn("ml-auto transition-transform", chevronClassName)} />
      </SidebarNavLinkItem>
    </Collapsible>
  );
}
