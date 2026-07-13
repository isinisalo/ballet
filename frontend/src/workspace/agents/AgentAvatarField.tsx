import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AgentAvatar } from "@shared/api/workspace-contracts";
import { useId } from "react";
import { AgentAvatarIcon, agentAvatarLabel, agentAvatarOptions } from "./agentAvatars";

const NONE_VALUE = "none";
const avatarItems = [
  { value: NONE_VALUE, label: "None" },
  ...agentAvatarOptions
];

function AvatarPreview({ avatar, compact, profile }: { avatar?: AgentAvatar; compact: boolean; profile: boolean }) {
  const label = agentAvatarLabel(avatar);
  return (
    <span
      role="img"
      aria-label={label ? `${label} avatar preview` : "No avatar selected"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-divider-strong bg-panel-section text-muted-foreground",
        profile ? "size-14" : compact ? "size-8" : "size-10"
      )}
    >
      <AgentAvatarIcon avatar={avatar} className={profile ? "size-6" : compact ? "size-4" : "size-5"} />
    </span>
  );
}

function AvatarSelect({ id, avatar, onChange, compact }: {
  id: string;
  avatar?: AgentAvatar;
  onChange: (avatar?: AgentAvatar) => void;
  compact: boolean;
}) {
  return (
    <Select items={avatarItems} value={avatar ?? NONE_VALUE} onValueChange={(value) => { if (value !== null) onChange(value === NONE_VALUE ? undefined : value as AgentAvatar); }}>
      <SelectTrigger id={id} aria-label="Avatar" className={cn("min-w-0 flex-1 font-mono", compact ? "h-10 text-base md:h-8 md:text-xs" : "text-sm")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {agentAvatarOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <AgentAvatarIcon avatar={option.value} />
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function AgentAvatarField({ avatar, onChange, compact = false, profile = false }: {
  avatar?: AgentAvatar;
  onChange: (avatar?: AgentAvatar) => void;
  compact?: boolean;
  profile?: boolean;
}) {
  const id = useId();
  const control = <div className="flex min-w-0 items-center gap-3"><AvatarPreview avatar={avatar} compact={compact} profile={profile} /><AvatarSelect id={id} avatar={avatar} onChange={onChange} compact={compact} /></div>;

  if (profile) {
    return <Field className="gap-1.5"><FieldLabel htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">Avatar</FieldLabel>{control}</Field>;
  }

  if (compact) {
    return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs leading-4"><FieldLabel htmlFor={id} className="text-muted-foreground">Avatar</FieldLabel>{control}</div>;
  }

  return <Field className="gap-1.5"><FieldLabel htmlFor={id} className="text-muted-foreground">Avatar</FieldLabel>{control}</Field>;
}
