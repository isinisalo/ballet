import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";

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
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          href={path}
          size="sm"
          isActive={active}
          aria-expanded={open}
          className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          onClick={(event) => {
            event.preventDefault();
            setOpen((current) => !current);
            navigate(path);
          }}
        >
          {icon}
          <span>{label}</span>
          <ChevronRight className={`ml-auto transition-transform ${chevronClassName}`} />
        </SidebarMenuSubButton>
        <CollapsibleContent>
          {children}
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
