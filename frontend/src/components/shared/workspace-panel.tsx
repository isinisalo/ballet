import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WorkspacePanel({
  title,
  titleExtra,
  description,
  icon,
  children,
  action,
  compact = false,
  flush = true,
  contentClassName,
  className
}: {
  title: string;
  titleExtra?: ReactNode;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  flush?: boolean;
  contentClassName?: string;
  className?: string;
}) {
  return (
    <Card className={cn(flush && "rounded-none ring-0", className)}>
      <CardHeader
        className={cn(
          "min-h-12 items-center gap-1.5 bg-card px-4 py-2.5 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]",
          description && "items-start",
          compact && "min-h-12 py-2.5"
        )}
      >
        <CardTitle className="flex min-w-0 items-center gap-2 font-mono text-xs font-medium leading-none text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
          {icon}
          <span className="truncate">{title}</span>
          {titleExtra}
        </CardTitle>
        {description ? <CardDescription className={cn(compact && "text-xs")}>{description}</CardDescription> : null}
        {action ? (
          <CardAction className={cn("col-start-2 row-span-1 row-start-1 justify-self-end self-center", description && "row-span-2 self-start")}>
            {action}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={cn("px-4 py-4", compact && "py-3", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export { WorkspacePanel as Panel };
