import { type ReactNode } from "react";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";

export function SidebarNavLinkItem({
  path,
  isActive,
  navigate,
  children,
  after,
  className,
  itemClassName,
  ariaExpanded,
  onNavigate,
  size = "sm"
}: {
  path: string;
  isActive: boolean;
  navigate: (path: string) => void;
  children: ReactNode;
  after?: ReactNode;
  className?: string;
  itemClassName?: string;
  ariaExpanded?: boolean;
  onNavigate?: (path: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <SidebarMenuSubItem className={itemClassName}>
      <SidebarMenuSubButton
        href={path}
        size={size}
        isActive={isActive}
        aria-expanded={ariaExpanded}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          onNavigate?.(path);
          navigate(path);
        }}
      >
        {children}
      </SidebarMenuSubButton>
      {after}
    </SidebarMenuSubItem>
  );
}
