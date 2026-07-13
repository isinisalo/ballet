import { useId } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { scheduleWeekdayLabel, scheduleWeekdays, type RecurringStepSchedule } from "./loopSchedulePresentation";

type Weekday = Extract<RecurringStepSchedule, { cadence: "weekly" }>["weekdays"][number];

export function LoopScheduleWeekdays({ value, disabled, error, onChange }: {
  value: Weekday[];
  disabled: boolean;
  error?: string;
  onChange: (value: Weekday[]) => void;
}) {
  const errorId = useId();
  const selected = new Set(value);
  const toggle = (weekday: Weekday) => {
    if (selected.has(weekday)) selected.delete(weekday);
    else selected.add(weekday);
    onChange(scheduleWeekdays.filter((candidate) => selected.has(candidate)));
  };
  return (
    <div className="grid gap-1">
      <div role="group" className="grid grid-cols-7 gap-1" aria-label="Weekly days" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
        {scheduleWeekdays.map((weekday) => (
          <Button
            key={weekday}
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            aria-label={scheduleWeekdayLabel(weekday)}
            aria-pressed={selected.has(weekday)}
            className="h-10 min-w-0 px-0 font-mono text-sm aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary md:h-7 md:text-[0.65rem]"
            onClick={() => toggle(weekday)}
          >
            {scheduleWeekdayLabel(weekday).slice(0, 2)}
          </Button>
        ))}
      </div>
      {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
    </div>
  );
}
