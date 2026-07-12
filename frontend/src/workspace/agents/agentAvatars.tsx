import type { AgentAvatar } from "@shared/api/workspace-contracts";
import {
  Bot,
  BrainCircuit,
  Code2,
  Compass,
  Hammer,
  Rocket,
  Search,
  Sparkles,
  type LucideIcon
} from "lucide-react";

export const agentAvatarOptions: ReadonlyArray<{ value: AgentAvatar; label: string }> = [
  { value: "bot", label: "Bot" },
  { value: "brain-circuit", label: "Brain circuit" },
  { value: "code-2", label: "Code 2" },
  { value: "compass", label: "Compass" },
  { value: "hammer", label: "Hammer" },
  { value: "rocket", label: "Rocket" },
  { value: "search", label: "Search" },
  { value: "sparkles", label: "Sparkles" }
];

const agentAvatarIcons: Record<AgentAvatar, LucideIcon> = {
  bot: Bot,
  "brain-circuit": BrainCircuit,
  "code-2": Code2,
  compass: Compass,
  hammer: Hammer,
  rocket: Rocket,
  search: Search,
  sparkles: Sparkles
};

export function AgentAvatarIcon({ avatar, className }: { avatar?: AgentAvatar; className?: string }) {
  if (!avatar) return null;
  const Icon = agentAvatarIcons[avatar];
  return <Icon aria-hidden="true" className={className} />;
}

export function agentAvatarLabel(avatar?: AgentAvatar) {
  return agentAvatarOptions.find((option) => option.value === avatar)?.label;
}
