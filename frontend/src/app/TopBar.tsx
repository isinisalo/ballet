import { Moon, Monitor, Sun } from "lucide-react";
import type { AppData } from "backend/shared/domain";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/theme";
import { cn } from "@/lib/utils";

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "light", label: "Light", icon: Sun },
  { mode: "system", label: "System", icon: Monitor }
];

export function TopBar({
  data,
  themeMode,
  onThemeModeChange
}: {
  data: AppData;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const project = data.projects[0];

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-3 py-3 backdrop-blur md:px-5">
      <div className="mx-auto flex w-full max-w-[92rem] items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{project?.name ?? "Ballet"}</div>
          <div className="truncate text-xs text-muted-foreground">Local workspace</div>
        </div>
        <div className="flex shrink-0 rounded-md border bg-muted/20 p-0.5" aria-label="Theme selector">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.mode}
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-7 gap-1.5 px-2 text-xs", themeMode === option.mode && "bg-background shadow-sm")}
                aria-pressed={themeMode === option.mode}
                onClick={() => onThemeModeChange(option.mode)}
              >
                <Icon className="size-3.5" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
