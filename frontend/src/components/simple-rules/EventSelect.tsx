import type { EventDefinition } from "backend/shared/domain";

export function EventSelect({
  label,
  value,
  events,
  onChange
}: {
  label: string;
  value: string;
  events: EventDefinition[];
  onChange: (eventType: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-medium" htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-event`}>{label}</label>
      <select
        id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-event`}
        className="h-8 w-full min-w-0 rounded-md border border-border bg-[color:var(--input)] px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose event</option>
        {events.map((eventDefinition) => (
          <option key={eventDefinition.eventType} value={eventDefinition.eventType}>
            {eventDefinition.name} · {eventDefinition.eventType}
          </option>
        ))}
      </select>
    </div>
  );
}
