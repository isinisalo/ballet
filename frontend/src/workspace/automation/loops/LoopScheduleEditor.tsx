import { useId, type ComponentProps } from "react";
import type { LoopScheduleState, ProjectScheduledStep, ProjectStepSchedule } from "@shared/api/workspace-contracts";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoopEditorSelect, compactLoopFormControl } from "./LoopEditorSelect";
import { LoopScheduleStatus } from "./LoopScheduleStatus";
import { LoopScheduleWeekdays } from "./LoopScheduleWeekdays";
import { changeScheduleCadence, changeScheduleKind, validateSchedule } from "./loopSchedulePresentation";

export function LoopScheduleEditor({ step, state, disabled, onChange }: {
  step: ProjectScheduledStep;
  state?: LoopScheduleState;
  disabled: boolean;
  onChange: (step: ProjectScheduledStep) => void;
}) {
  const schedule = step.schedule;
  const errors = validateSchedule(schedule);
  const updateSchedule = (next: ProjectStepSchedule) => onChange({ ...step, schedule: next });
  const updateCommon = (field: "time" | "timeZone", value: string) => updateSchedule({ ...schedule, [field]: value });

  return (
    <div className="grid gap-3">
      <ScheduleSelectField label="Schedule" ariaLabel="Schedule kind" value={schedule.kind} disabled={disabled} options={[{ value: "once", label: "Once" }, { value: "recurring", label: "Recurring" }]} onChange={(kind) => updateSchedule(changeScheduleKind(schedule, kind as ProjectStepSchedule["kind"]))} />

      <ScheduleInput
        label={schedule.kind === "once" ? "Date" : "Starts on"}
        ariaLabel={schedule.kind === "once" ? "Schedule date" : "Schedule starts on"}
        type="date"
        value={schedule.kind === "once" ? schedule.date : schedule.startsOn}
        error={schedule.kind === "once" ? errors.date : errors.startsOn}
        disabled={disabled}
        onChange={(value) => updateSchedule(schedule.kind === "once" ? { ...schedule, date: value } : { ...schedule, startsOn: value })}
      />
      <ScheduleInput label="Time" ariaLabel="Schedule time" type="time" value={schedule.time} error={errors.time} disabled={disabled} onChange={(value) => updateCommon("time", value)} />
      <ScheduleInput label="Time zone" ariaLabel="Schedule time zone" value={schedule.timeZone} error={errors.timeZone} disabled={disabled} onChange={(value) => updateCommon("timeZone", value)} />

      {schedule.kind === "recurring" ? (
        <>
          <ScheduleSelectField
            label="Cadence"
            ariaLabel="Schedule cadence"
            value={schedule.cadence}
            disabled={disabled}
            options={[{ value: "daily", label: "Daily" }, { value: "weekdays", label: "Weekdays" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
            onChange={(cadence) => updateSchedule(changeScheduleCadence(schedule, cadence as typeof schedule.cadence))}
          />
          {schedule.cadence === "weekly" ? (
            <FieldSet className="grid gap-1">
              <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Weekdays</FieldLegend>
              <LoopScheduleWeekdays value={schedule.weekdays} error={errors.weekdays} disabled={disabled} onChange={(weekdays) => updateSchedule({ ...schedule, weekdays })} />
            </FieldSet>
          ) : null}
          {schedule.cadence === "monthly" ? (
            <ScheduleInput label="Day" ariaLabel="Schedule day of month" type="number" min={1} max={31} step={1} value={String(schedule.dayOfMonth)} error={errors.dayOfMonth} disabled={disabled} onChange={(value) => updateSchedule({ ...schedule, dayOfMonth: Number(value) })} />
          ) : null}
        </>
      ) : null}

      <LoopScheduleStatus state={state} timeZone={schedule.timeZone} />
    </div>
  );
}

function ScheduleInput({ label, ariaLabel, error, onChange, ...props }: Omit<ComponentProps<typeof Input>, "onChange"> & {
  label: string;
  ariaLabel: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground @sm/loop-form:pt-1">{label}</FieldLabel>
      <div className="grid gap-1">
        <Input {...props} id={id} aria-label={ariaLabel} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={compactLoopFormControl} onChange={(event) => onChange(event.target.value)} />
        {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
      </div>
    </Field>
  );
}

function ScheduleSelectField({ label, ariaLabel, value, options, disabled, invalid, error, onChange }: {
  label: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  invalid?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(invalid || error)}>
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground @sm/loop-form:pt-1">{label}</FieldLabel>
      <div className="grid min-w-0 gap-1">
        <LoopEditorSelect id={id} ariaLabel={ariaLabel} describedBy={error ? errorId : undefined} density="form" value={value} disabled={disabled} invalid={Boolean(invalid || error)} options={options} onChange={onChange} />
        {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
      </div>
    </Field>
  );
}
