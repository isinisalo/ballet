import type { LoopScheduleState, ProjectScheduledWorkNode, ProjectWorkSchedule } from "@shared/api/workspace-contracts";
import { SelectField, TextField } from "@/components/shared/workspace-ui";
import { Field, FieldLabel } from "@/components/ui/field";
import { LoopScheduleStatus } from "./LoopScheduleStatus";
import { LoopScheduleWeekdays } from "./LoopScheduleWeekdays";
import {
  changeScheduleCadence,
  changeScheduleKind,
  validateSchedule,
  type RecurringWorkSchedule
} from "./loopSchedulePresentation";

export function WorkScheduleEditor({ node, state, disabled, onChange }: {
  node: ProjectScheduledWorkNode;
  state?: LoopScheduleState;
  disabled: boolean;
  onChange: (node: ProjectScheduledWorkNode) => void;
}) {
  const schedule = node.schedule;
  const errors = validateSchedule(schedule);
  const update = (next: ProjectWorkSchedule) => onChange({ ...node, schedule: next });

  return (
    <section aria-label="Work schedule" className="grid gap-3 rounded-lg border border-divider-strong bg-background p-3">
      <h4 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Work schedule</h4>
      <SelectField
        label="Schedule kind"
        value={schedule.kind}
        options={[{ value: "once", label: "Once" }, { value: "recurring", label: "Recurring" }]}
        disabled={disabled}
        density="compact"
        onChange={(kind) => update(changeScheduleKind(schedule, kind as ProjectWorkSchedule["kind"]))}
      />
      <TextField
        label={schedule.kind === "once" ? "Schedule date" : "Schedule starts on"}
        type="date"
        value={schedule.kind === "once" ? schedule.date : schedule.startsOn}
        error={schedule.kind === "once" ? errors.date : errors.startsOn}
        disabled={disabled}
        density="compact"
        onChange={(value) => update(schedule.kind === "once" ? { ...schedule, date: value } : { ...schedule, startsOn: value })}
      />
      <TextField label="Schedule time" type="time" value={schedule.time} error={errors.time} disabled={disabled} density="compact" onChange={(time) => update({ ...schedule, time })} />
      <TextField label="Schedule time zone" value={schedule.timeZone} error={errors.timeZone} disabled={disabled} density="compact" onChange={(timeZone) => update({ ...schedule, timeZone })} />
      {schedule.kind === "recurring" ? (
        <RecurringScheduleFields schedule={schedule} disabled={disabled} errors={errors} onChange={update} />
      ) : null}
      <LoopScheduleStatus state={state} timeZone={schedule.timeZone} />
    </section>
  );
}

function RecurringScheduleFields({ schedule, disabled, errors, onChange }: {
  schedule: RecurringWorkSchedule;
  disabled: boolean;
  errors: ReturnType<typeof validateSchedule>;
  onChange: (schedule: ProjectWorkSchedule) => void;
}) {
  return (
    <>
      <SelectField
        label="Schedule cadence"
        value={schedule.cadence}
        options={[
          { value: "daily", label: "Daily" },
          { value: "weekdays", label: "Weekdays" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" }
        ]}
        disabled={disabled}
        density="compact"
        onChange={(cadence) => onChange(changeScheduleCadence(schedule, cadence as RecurringWorkSchedule["cadence"]))}
      />
      {schedule.cadence === "weekly" ? (
        <Field className="gap-1.5">
          <FieldLabel className="text-xs font-normal text-muted-foreground">Schedule weekdays</FieldLabel>
          <LoopScheduleWeekdays value={schedule.weekdays} error={errors.weekdays} disabled={disabled} onChange={(weekdays) => onChange({ ...schedule, weekdays })} />
        </Field>
      ) : null}
      {schedule.cadence === "monthly" ? (
        <TextField
          label="Schedule day of month"
          type="number"
          value={schedule.dayOfMonth}
          error={errors.dayOfMonth}
          disabled={disabled}
          density="compact"
          onChange={(value) => onChange({ ...schedule, dayOfMonth: Number(value) })}
        />
      ) : null}
    </>
  );
}
