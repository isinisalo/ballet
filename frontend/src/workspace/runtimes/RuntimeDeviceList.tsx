import { AlertTriangle, Monitor, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deviceHasIssues, providerLabel } from "./runtimeRegistry";
import type { RuntimeDevice, RuntimeDeviceFilter } from "./types";

const filters: Array<{ value: RuntimeDeviceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "issues", label: "Issues" }
];

export function RuntimeDeviceList({
  devices,
  selectedDeviceId,
  search,
  status,
  loading,
  onSearchChange,
  onStatusChange,
  onSelect
}: {
  devices: RuntimeDevice[];
  selectedDeviceId?: string;
  search: string;
  status: RuntimeDeviceFilter;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: RuntimeDeviceFilter) => void;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <aside className="min-w-0 border-b border-divider-strong bg-panel-section lg:border-r lg:border-b-0" aria-label="Runtime computers">
      <div className="grid gap-2 border-b border-divider-strong p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search computers"
            className="h-8 pl-8"
            placeholder="Search computers"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex gap-1" aria-label="Runtime status filter">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="xs"
              variant={filter.value === status ? "default" : "outline"}
              aria-pressed={filter.value === status}
              onClick={() => onStatusChange(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="max-h-[34rem] overflow-y-auto p-1.5">
        {loading && devices.length === 0 ? <p className="p-3 text-xs text-muted-foreground">Loading computers…</p> : null}
        {!loading && devices.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No computers match this view.</p> : null}
        {devices.map((device) => {
          const issues = deviceHasIssues(device);
          return (
            <button
              key={device.id}
              type="button"
              className={cn(
                "grid w-full gap-1 rounded px-2.5 py-2 text-left hover:bg-muted/60",
                selectedDeviceId === device.id && "bg-muted text-foreground shadow-[inset_3px_0_0_0] shadow-primary"
              )}
              aria-pressed={selectedDeviceId === device.id}
              onClick={() => onSelect(device.id)}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="relative shrink-0">
                  <Monitor className="size-4 text-muted-foreground" />
                  <span className={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-panel-section",
                    device.status === "online" ? "bg-secondary" : "bg-muted-foreground/55"
                  )} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{device.displayName}</span>
                {issues ? <AlertTriangle className="size-3.5 shrink-0 text-tertiary" aria-label="Issues" /> : null}
              </span>
              <span className="flex min-w-0 items-center justify-between gap-2 font-mono text-[0.62rem] text-muted-foreground">
                <span className="truncate">{device.hostname} · {device.platform}/{device.architecture}</span>
                <span className="shrink-0">{device.backends.map((backend) => providerLabel(backend.provider).split(" ")[0]).join(" + ") || "No CLI"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
