import type { ComponentProps } from "react";
import type { LoopScheduleState, ProjectScheduledStep, ProjectStepSchedule } from "@shared/api/workspace-contracts";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoopEditorSelect, compactLoopControl } from "./LoopEditorSelect";
import { LoopScheduleStatus } from "./LoopScheduleStatus";
import { LoopScheduleWeekdays } from "./LoopScheduleWeekdays";
import { changeScheduleCadence, changeScheduleKind, validateSchedule } from "./loopSchedulePresentation";

export function LoopScheduleEditor({ step, targets, state, disabled, onChange }: {
  step: ProjectScheduledStep;
  targets: Array<{ value: string; label: string }>;
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
      <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
        <FieldLabel className="text-xs font-normal text-muted-foreground">Schedule</FieldLabel>
        <LoopEditorSelect ariaLabel="Schedule kind" value={schedule.kind} disabled={disabled} options={[{ value: "once", label: "Once" }, { value: "recurring", label: "Recurring" }]} onChange={(kind) => updateSchedule(changeScheduleKind(schedule, kind as ProjectStepSchedule["kind"]))} />
      </Field>

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
          <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
            <FieldLabel className="text-xs font-normal text-muted-foreground">Cadence</FieldLabel>
            <LoopEditorSelect
              ariaLabel="Schedule cadence"
              value={schedule.cadence}
              disabled={disabled}
              options={[{ value: "daily", label: "Daily" }, { value: "weekdays", label: "Weekdays" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
              onChange={(cadence) => updateSchedule(changeScheduleCadence(schedule, cadence as typeof schedule.cadence))}
            />
          </Field>
          {schedule.cadence === "weekly" ? (
            <Field className="grid gap-1">
              <FieldLabel className="text-xs font-normal text-muted-foreground">Weekdays</FieldLabel>
              <LoopScheduleWeekdays value={schedule.weekdays} error={errors.weekdays} disabled={disabled} onChange={(weekdays) => updateSchedule({ ...schedule, weekdays })} />
            </Field>
          ) : null}
          {schedule.cadence === "monthly" ? (
            <ScheduleInput label="Day" ariaLabel="Schedule day of month" type="number" min={1} max={31} step={1} value={String(schedule.dayOfMonth)} error={errors.dayOfMonth} disabled={disabled} onChange={(value) => updateSchedule({ ...schedule, dayOfMonth: Number(value) })} />
          ) : null}
        </>
      ) : null}

      <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
        <FieldLabel className="text-xs font-normal text-muted-foreground">Trigger</FieldLabel>
        <LoopEditorSelect ariaLabel="Triggered transition target" value={step.on.triggered} disabled={disabled || targets.length === 0} options={targets} onChange={(triggered) => onChange({ ...step, on: { triggered } })} />
      </Field>
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
  return (
    <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2" data-invalid={Boolean(error)}>
      <FieldLabel className="pt-1 text-xs font-normal text-muted-foreground">{label}</FieldLabel>
      <div className="grid gap-1">
        <Input {...props} aria-label={ariaLabel} aria-invalid={Boolean(error)} className={compactLoopControl} onChange={(event) => onChange(event.target.value)} />
        {error ? <FieldError className="text-[0.65rem] leading-4">{error}</FieldError> : null}
      </div>
    </Field>
  );
}
