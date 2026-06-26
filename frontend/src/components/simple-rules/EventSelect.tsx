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
    <div className="grid gap-1.5">
      <label className="text-sm font-medium" htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-event`}>{label}</label>
      <select
        id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-event`}
        className="h-10 rounded-md border bg-background px-3 text-sm"
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
