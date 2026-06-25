import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMap, parseDocument, stringify as stringifyYaml } from "yaml";
import {
  Archive,
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  Code2,
  Eye,
  FileKey2,
  GitBranch,
  Hash,
  Inbox,
  Layers3,
  Menu,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Route,
  Save,
  Sun,
  Tags,
  Trash2,
  UserRound,
  Workflow,
  type LucideIcon
} from "lucide-react";
import type { Adr, Agent, AgentRun, AgentRunLog, AppData, EventDefinition, Goal, MarkdownDocument, Policy, Project, ProjectDocumentTreeNode, Runtime, Skill } from "../../backend/shared/domain";
import { seedData } from "../../backend/shared/seed";
import { api } from "./api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { applyThemeMode, getStoredThemeMode, persistThemeMode, type ThemeMode } from "./theme";
import {
  applyWorkflowToPolicy,
  derivePolicyWorkflows,
  eventTypesForWorkflowPolicy,
  findOutputEventDefinition,
  mergeReadyProducer,
  targetAgentIdForWorkflowPolicy,
  type PolicyWorkflow,
  type WorkflowDraft
} from "./workflow-orchestrator";

type View = "projects" | "project-document" | "project-goals" | "project-adrs" | "workflow-orchestrator" | "agents" | "skills" | "runtimes" | "policies" | "events" | "agent-runs";
type SaveCollection = "projects" | "goals" | "adrs" | "agents" | "skills" | "runtimes" | "policies";

interface RouteState {
  view: View;
  projectId?: string;
  documentPath?: string;
}

const emptyData: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  skills: [],
  runtimes: [],
  policies: [],
  eventDefinitions: [],
  events: [],
  agentRuns: [],
  projectDocumentTree: []
};

const toKeyValueLines = (values: Record<string, string>) => Object.entries(values).map(([key, item]) => `${key}=${item}`).join("\n");
const fromKeyValueLines = (value: string) =>
  Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim()];
      })
      .filter(([key]) => key)
  );

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parsePayload = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
};

const parseJsonArray = (value: string): unknown[] => {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Value must be a JSON array.");
  }
  return parsed;
};

const parseEventProducers = (value: string): EventDefinition["producers"] => {
  const producers = parseJsonArray(value);
  return producers.map((producer) => {
    if (!isPlainRecord(producer) || typeof producer.agentRole !== "string" || !Array.isArray(producer.outcomes)) {
      throw new Error("Each producer must include agentRole and outcomes.");
    }

    return {
      agentRole: producer.agentRole,
      outcomes: producer.outcomes.map(String) as EventDefinition["producers"][number]["outcomes"],
      requires: isPlainRecord(producer.requires) ? producer.requires as EventDefinition["producers"][number]["requires"] : undefined
    };
  });
};

const readJson = (value: unknown) => JSON.stringify(value, null, 2);
const frontmatterToYaml = (frontmatter?: Record<string, unknown>) => stringifyYaml(frontmatter ?? {}).trimEnd();
const parseFrontmatterYaml = (value: string): Record<string, unknown> => {
  if (!value.trim()) return {};

  const document = parseDocument(value, { prettyErrors: false });
  if (document.errors.length > 0) {
    throw new Error(document.errors[0]?.message ?? "Invalid YAML frontmatter.");
  }

  const parsed = document.toJSON();
  if (parsed === null) return {};
  if (!isMap(document.contents) || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML mapping/object.");
  }

  return parsed as Record<string, unknown>;
};

const codexModelOptions = [
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" }
];

const reasoningEffortOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" }
];

const reasoningEffortOrder = reasoningEffortOptions.map((option) => option.value);

const reasoningEffortTone = (value: string) => {
  if (value === "low") return "border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/15";
  if (value === "medium") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/15";
  if (value === "high") return "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15";
  return "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15";
};

const nextReasoningEffort = (value: string) => {
  const currentIndex = reasoningEffortOrder.indexOf(value);
  return reasoningEffortOrder[(currentIndex + 1) % reasoningEffortOrder.length] ?? reasoningEffortOptions[0].value;
};

const skillTemplate = (): Partial<Skill> => ({
  name: "",
  description: "",
  metadata: {},
  body: ""
});

const runtimeTemplate = (): Partial<Runtime> => ({
  name: "codex-cli",
  type: "codex-cli",
  command: "codex",
  enabled: true,
  config: { cwd: ".", approvalPolicy: "never" }
});

const agentTemplate = (): Partial<Agent> => ({
  name: "",
  description: "",
  instructions: "",
  skills: [],
  enabled: true,
  status: "offline",
  model: codexModelOptions[0]?.value ?? "gpt-5.5",
  modelReasoningEffort: "medium"
});

const policyTemplate = (targetAgentId: string): Partial<Policy> => ({
  name: "",
  description: "",
  active: true,
  match: {
    eventTypes: [],
    projectId: "*",
    source: "*"
  },
  action: {
    type: "start_agent_run",
    targetAgentId
  },
  projectId: "*",
  eventTypes: [],
  source: "*",
  payloadMetadata: {},
  targetAgentId
});

const eventDefinitionTemplate = (): Partial<EventDefinition> => ({
  name: "",
  description: "",
  active: true,
  eventType: "",
  source: "agentd",
  tags: [],
  producers: [],
  payloadExample: {},
  body: ""
});

const payloadMetadataToMatchPayload = (metadata?: Record<string, string>) =>
  Object.fromEntries(Object.entries(metadata ?? {}).map(([key, value]) => [key, { operator: "equals" as const, value }]));

const policyMatchForForm = (policy: Partial<Policy>): NonNullable<Policy["match"]> => {
  if (policy.match) return policy.match;
  const payload = payloadMetadataToMatchPayload(policy.payloadMetadata);
  return {
    eventTypes: policy.eventTypes ?? [],
    projectId: policy.projectId ?? "*",
    source: policy.source ?? "*",
    ...(Object.keys(payload).length > 0 ? { payload } : {})
  };
};

const policyTargetForForm = (policy: Partial<Policy>, fallback: string) =>
  policy.action?.type === "start_agent_run" && policy.action.targetAgentId ? policy.action.targetAgentId : policy.targetAgentId ?? fallback;

const parsePolicyMatch = (value: string): NonNullable<Policy["match"]> => {
  const parsed = parsePayload(value);
  return parsed as NonNullable<Policy["match"]>;
};

const eventTypesForPolicy = (policy: Partial<Policy>): string[] => policy.match?.eventTypes ?? policy.eventTypes ?? [];

const advancedPolicyMatchForForm = (policy: Partial<Policy>): NonNullable<Policy["match"]> => {
  const advancedMatch = { ...policyMatchForForm(policy) };
  delete advancedMatch.eventTypes;
  return advancedMatch;
};

const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const goalsMatch = url.pathname.match(/^\/projects\/([^/]+)\/goals\/?$/);
  if (goalsMatch) return { view: "project-goals", projectId: decodeURIComponent(goalsMatch[1]) };

  const adrsMatch = url.pathname.match(/^\/projects\/([^/]+)\/adrs\/?$/);
  if (adrsMatch) return { view: "project-adrs", projectId: decodeURIComponent(adrsMatch[1]) };

  if (url.pathname === "/projects/document") {
    const documentPath = url.searchParams.get("path") ?? undefined;
    return documentPath ? { view: "project-document", documentPath } : { view: "projects" };
  }

  if (url.pathname === "/agents") return { view: "agents", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/workflow-orchestrator") return { view: "workflow-orchestrator" };
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/runtimes") return { view: "runtimes", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/policies") return { view: "policies", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/events") return { view: "events", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/agent-runs") return { view: "agent-runs" };
  return { view: "projects" };
};

const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
const runtimeDocumentPath = (relativePath: string) => `/runtimes?path=${encodeURIComponent(relativePath)}`;
const policyDocumentPath = (relativePath: string) => `/policies?path=${encodeURIComponent(relativePath)}`;
const eventDefinitionDocumentPath = (relativePath: string) => `/events?path=${encodeURIComponent(relativePath)}`;

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["unassigned", "at-risk", "rejected"].includes(status)) return "destructive";
  if (["routed", "done", "accepted", "handled"].includes(status)) return "default";
  if (["in-progress", "proposed", "received", "active"].includes(status)) return "secondary";
  return "outline";
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: LucideIcon }> = [
  { mode: "light", label: "Light theme", icon: Sun },
  { mode: "dark", label: "Dark theme", icon: Moon },
  { mode: "system", label: "System theme", icon: Monitor }
];

function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());

  useEffect(() => {
    persistThemeMode(themeMode);
    applyThemeMode(themeMode);

    if (themeMode !== "system") return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeMode("system");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  return [themeMode, setThemeMode] as const;
}

function ThemeSelector({ mode, onChange }: { mode: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  return (
    <div className="flex w-fit items-center gap-1 self-start rounded-lg border bg-card p-1" aria-label="Theme selector">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.mode}
            type="button"
            size="icon-sm"
            variant={mode === option.mode ? "default" : "ghost"}
            aria-pressed={mode === option.mode}
            title={option.label}
            onClick={() => onChange(option.mode)}
          >
            <Icon data-icon="inline-start" />
            <span className="sr-only">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

type MarkdownEntity = Pick<Project | Goal | Adr | MarkdownDocument | Skill | Runtime | EventDefinition, "id" | "frontmatter" | "body" | "relativePath" | "errors"> & {
  createdAt?: string;
  updatedAt?: string;
  name?: string;
  title?: string;
  status?: string;
  targetDate?: string;
  owner?: string;
};

const documentTitle = (document: MarkdownEntity) =>
  document.title || document.name || (typeof document.frontmatter?.title === "string" ? document.frontmatter.title : undefined) || document.id;

const projectTreeContainsPath = (nodes: ProjectDocumentTreeNode[], relativePath?: string): boolean =>
  Boolean(relativePath) && nodes.some((node) =>
    node.type === "file"
      ? node.document.relativePath === relativePath
      : projectTreeContainsPath(node.children, relativePath)
  );

type ProjectTreeDirectory = Extract<ProjectDocumentTreeNode, { type: "directory" }>;

const findProjectTreeDirectory = (nodes: ProjectDocumentTreeNode[], relativePath: string): ProjectTreeDirectory | undefined => {
  for (const node of nodes) {
    if (node.type === "directory") {
      if (node.relativePath === relativePath) return node;
      const directory = findProjectTreeDirectory(node.children, relativePath);
      if (directory) return directory;
    }
  }
  return undefined;
};

const findProjectTreeDocument = (nodes: ProjectDocumentTreeNode[], relativePath?: string): MarkdownDocument | undefined => {
  if (!relativePath) return undefined;
  for (const node of nodes) {
    if (node.type === "file" && node.document.relativePath === relativePath) return node.document;
    if (node.type === "directory") {
      const document = findProjectTreeDocument(node.children, relativePath);
      if (document) return document;
    }
  }
  return undefined;
};

const isSimpleFrontmatterValue = (value: unknown) => value === null || ["string", "number", "boolean", "undefined"].includes(typeof value);
const isSimpleFrontmatterArray = (value: unknown[]) => value.every(isSimpleFrontmatterValue);

const frontmatterIcon = (fieldKey: string): LucideIcon => {
  if (fieldKey === "id") return Hash;
  if (["date", "created_date", "updated_date", "createdAt", "updatedAt"].includes(fieldKey)) return CalendarDays;
  if (fieldKey === "status") return CheckCircle2;
  if (["owner", "decision_authority"].includes(fieldKey)) return UserRound;
  if (fieldKey === "tags") return Tags;
  return FileKey2;
};

function FrontmatterValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    if (isSimpleFrontmatterArray(value)) {
      return (
        <span className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <Badge
              key={`${String(item)}-${index}`}
              variant={fieldKey === "tags" ? "outline" : "secondary"}
              className="h-4 rounded px-1.5 font-mono text-[0.6rem] uppercase"
            >
              {String(item)}
            </Badge>
          ))}
        </span>
      );
    }
  }

  if (value && typeof value === "object") {
    return (
      <pre className="max-h-32 overflow-x-auto rounded-md bg-muted/60 p-2 text-xs leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">empty</span>;
  if (fieldKey === "status") {
    return (
      <Badge variant={statusVariant(String(value))} className="h-5 rounded px-2 font-mono text-[0.65rem] uppercase">
        {String(value)}
      </Badge>
    );
  }
  return <span className="font-medium">{String(value)}</span>;
}

function FrontmatterPanel({ frontmatter }: { frontmatter?: Record<string, unknown> }) {
  const entries = Object.entries(frontmatter ?? {}).filter(([key]) => key !== "id");

  return (
    <aside className="rounded-lg border bg-card/95 px-3 py-2.5 shadow-sm ring-1 ring-foreground/5">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No frontmatter.</p>
      ) : (
        <dl className="flex flex-wrap">
          {entries.map(([key, value], index) => {
            const Icon = frontmatterIcon(key);
            const isComplexObject = Boolean(value && typeof value === "object" && !Array.isArray(value));
            return (
              <div
                key={key}
                className={cn(
                  "min-w-36 flex-1 border-border/70 py-1.5 pr-5",
                  index > 0 && "border-l pl-5",
                  isComplexObject && "basis-full"
                )}
              >
                <dt className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.65rem] font-semibold uppercase leading-none text-muted-foreground">
                  <Icon className="size-3" />
                  {key}
                </dt>
                <dd className="min-w-0 break-words text-sm leading-snug text-foreground">
                  <FrontmatterValue fieldKey={key} value={value} />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </aside>
  );
}

const normalizeHeadingText = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const removeMatchingLeadingH1 = (source: string, title?: string) => {
  if (!title) return source;
  return source.replace(/^#\s+(.+?)\s*\n+/, (match, heading: string) =>
    normalizeHeadingText(heading) === normalizeHeadingText(title) ? "" : match
  );
};

function MarkdownBody({ source, title }: { source?: string; title?: string }) {
  const body = removeMatchingLeadingH1(source?.trim() ?? "", title).trim();
  if (!body) return <p className="text-muted-foreground">No Markdown body.</p>;

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}

function MarkdownDocumentView({ document, emptyTitle, compact = false, embedded = false }: { document?: MarkdownEntity; emptyTitle: string; compact?: boolean; embedded?: boolean }) {
  if (!document) return <EmptyState title={emptyTitle} />;
  const title = documentTitle(document);

  return (
    <div className="grid auto-rows-min gap-4 self-start">
      <FrontmatterPanel frontmatter={document.frontmatter} />
      <article className={cn("min-w-0", embedded ? "p-0" : "rounded-lg border bg-card p-5 md:p-8")}>
        {document.errors?.length ? (
          <header className="mb-6 flex min-w-0 flex-wrap items-center gap-2 border-b pb-5">
            <ErrorPreview errors={document.errors} />
          </header>
        ) : null}
        <div className={cn(compact && "markdown-body-compact")}>
          <MarkdownBody source={document.body} title={title} />
        </div>
      </article>
    </div>
  );
}

function ProjectDocumentTree({
  nodes,
  activePath,
  navigate,
  level = 0
}: {
  nodes: ProjectDocumentTreeNode[];
  activePath?: string;
  navigate: (path: string) => void;
  level?: number;
}) {
  if (nodes.length === 0) return null;

  return (
    <SidebarMenuSub className={cn(level > 0 && "mx-2 mt-1 gap-0.5 border-sidebar-border/60 px-2 py-1")}>
      {nodes.map((node) => (
        node.type === "file" ? (
          <SidebarMenuSubItem key={node.document.relativePath}>
            <SidebarMenuSubButton
              href={projectDocumentPath(node.document.relativePath)}
              size="sm"
              isActive={node.document.relativePath === activePath}
              className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(projectDocumentPath(node.document.relativePath));
              }}
            >
              <span>{node.label}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ) : (
          <ProjectDocumentTreeDirectory
            key={node.relativePath}
            node={node}
            activePath={activePath}
            navigate={navigate}
            level={level}
          />
        )
      ))}
    </SidebarMenuSub>
  );
}

function ProjectDocumentTreeDirectory({
  node,
  activePath,
  navigate,
  level
}: {
  node: Extract<ProjectDocumentTreeNode, { type: "directory" }>;
  activePath?: string;
  navigate: (path: string) => void;
  level: number;
}) {
  const containsActive = projectTreeContainsPath(node.children, activePath);
  const [open, setOpen] = useState(containsActive);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <SidebarMenuSubItem>
      <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            asChild
            size="sm"
            isActive={containsActive}
            className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <button type="button">
              <span>{node.label}</span>
              <ChevronDown className={cn("ml-auto transition-transform", open && "rotate-180")} />
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ProjectDocumentTree nodes={node.children} activePath={activePath} navigate={navigate} level={level + 1} />
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

type SidebarDocumentEntity = Pick<Agent | Skill | Runtime | Policy | EventDefinition, "id" | "name" | "relativePath">;
type SidebarAgentEntity = Pick<Agent, "id" | "name" | "relativePath" | "status">;

function SidebarDocumentList({
  documents,
  activePath,
  pathFor,
  navigate
}: {
  documents: SidebarDocumentEntity[];
  activePath?: string;
  pathFor: (relativePath: string) => string;
  navigate: (path: string) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <SidebarMenuSub>
      {documents.map((document) => {
        const relativePath = document.relativePath;
        if (!relativePath) return null;
        const path = pathFor(relativePath);
        return (
          <SidebarMenuSubItem key={document.id}>
            <SidebarMenuSubButton
              href={path}
              size="sm"
              isActive={relativePath === activePath}
              className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(path);
              }}
            >
              <span>{document.name}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}

function SidebarAgentList({
  agents,
  activePath,
  navigate
}: {
  agents: SidebarAgentEntity[];
  activePath?: string;
  navigate: (path: string) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <SidebarMenuSub>
      {agents.map((agent) => {
        const relativePath = agent.relativePath;
        if (!relativePath) return null;
        const path = agentDocumentPath(relativePath);
        return (
          <SidebarMenuSubItem key={agent.id}>
            <SidebarMenuSubButton
              href={path}
              size="sm"
              isActive={relativePath === activePath}
              className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(path);
              }}
            >
              <AgentStatusDot status={agent.status} />
              <span>{agent.name}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}

function SidebarProjectDirectoryMenu({
  label,
  icon,
  node,
  activePath,
  navigate
}: {
  label: string;
  icon: ReactNode;
  node?: ProjectTreeDirectory;
  activePath?: string;
  navigate: (path: string) => void;
}) {
  const active = projectTreeContainsPath(node?.children ?? [], activePath);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (!node) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={active} tooltip={label}>
            {icon}
            <span>{label}</span>
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ProjectDocumentTree nodes={node.children} activePath={activePath} navigate={navigate} />
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function ErrorPreview({ errors }: { errors?: string[] }) {
  if (!errors?.length) return <span className="text-muted-foreground">None</span>;
  return <span className="text-destructive">{errors.join("; ")}</span>;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  compact = false
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Input className={compact ? "min-w-0" : undefined} value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  required = false,
  className,
  compact = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Textarea className={className} value={value} rows={rows} required={required} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  compact = false
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel className={compact ? "text-muted-foreground" : undefined}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-0 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      size="default"
      checked={checked}
      aria-label={label}
      title={label}
      className="data-checked:bg-emerald-500 data-unchecked:bg-muted-foreground/40 dark:data-unchecked:bg-muted-foreground/45"
      onCheckedChange={onChange}
    />
  );
}

function EmptyState({ title, action }: { title: string; action?: string }) {
  return (
    <Alert>
      <Archive data-icon="inline-start" />
      <AlertDescription>
        <span className="font-medium text-foreground">{title}</span>
        {action ? <span className="ml-2 text-muted-foreground">{action}</span> : null}
      </AlertDescription>
    </Alert>
  );
}

function AgentStatusDot({ status }: { status: Agent["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "online" ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/15" : "bg-muted-foreground/45"
      )}
    />
  );
}

function AgentStatusBadge({ status }: { status: Agent["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit gap-1.5 rounded-md px-2 font-normal",
        status === "online" ? "border-emerald-500/35 text-emerald-500" : "text-muted-foreground"
      )}
    >
      <AgentStatusDot status={status} />
      {status === "online" ? "Online" : "Offline"}
    </Badge>
  );
}

function AgentEnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge variant={enabled ? "secondary" : "outline"} className="w-fit rounded-md px-2 font-normal">
      {enabled ? "Enabled" : "Disabled"}
    </Badge>
  );
}

function Panel({ title, description, icon, children, action, compact = false }: { title: string; description?: string; icon: ReactNode; children: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <Card>
      <CardHeader
        className={cn(
          "px-4 py-3 has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
          compact && "gap-1.5"
        )}
      >
        <CardTitle className={cn("flex items-center gap-2", compact && "text-base")}>
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription className={cn(compact && "text-xs")}>{description}</CardDescription> : null}
        {action ? (
          <CardAction
            className={cn(
              "col-start-1 row-span-1 justify-self-start self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end sm:self-center",
              description ? "row-start-3" : "row-start-2"
            )}
          >
            {action}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={cn("px-4 py-4", compact && "py-3")}>{children}</CardContent>
    </Card>
  );
}

function DataTable({
  columns,
  rows,
  empty
}: {
  columns: string[];
  rows: Array<{ id: string; cells: ReactNode[]; onClick?: () => void; action?: ReactNode }>;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;

  const hasActions = rows.some((row) => row.action);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
          {hasActions ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} onClick={row.onClick} className={cn(row.onClick && "cursor-pointer")}>
            {row.cells.map((cell, index) => (
              <TableCell key={`${row.id}-${index}`} className="max-w-[28rem] whitespace-normal">
                {cell}
              </TableCell>
            ))}
            {hasActions ? <TableCell className="w-10">{row.action}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const newWorkflowId = "__new_workflow__";
type WorkflowNodeId = "input" | "policy" | "agent" | "output";
type WorkflowDraftState = WorkflowDraft & {
  policyId?: string;
  policyName: string;
  policyDescription: string;
  policyActive: boolean;
};

function AppSidebar({
  route,
  projectDocumentTree,
  agents,
  skills,
  runtimes,
  policies,
  eventDefinitions,
  workflows,
  selectedWorkflowPolicyId,
  selectWorkflow,
  navigate,
  themeMode,
  onThemeModeChange
}: {
  route: RouteState;
  projectDocumentTree: ProjectDocumentTreeNode[];
  agents: Agent[];
  skills: Skill[];
  runtimes: Runtime[];
  policies: Policy[];
  eventDefinitions: EventDefinition[];
  workflows: PolicyWorkflow[];
  selectedWorkflowPolicyId: string;
  selectWorkflow: (policyId: string) => void;
  navigate: (path: string) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";
  const runtimesOpen = route.view === "runtimes";
  const policiesOpen = route.view === "policies";
  const eventsOpen = route.view === "events";
  const workflowOpen = route.view === "workflow-orchestrator";
  const adrDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/adr");
  const goalsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/goals");
  const item = (label: string, icon: ReactNode, path: string, active: boolean) => (
    <SidebarMenuItem key={label}>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <a href={path} onClick={(event) => { event.preventDefault(); navigate(path); }}>
          {icon}
          <span>{label}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="AgentOps">
              <Route />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">AgentOps</span>
                <span className="text-xs text-muted-foreground">MVP control plane</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarProjectDirectoryMenu label="ADR" icon={<Archive />} node={adrDirectory} activePath={route.documentPath} navigate={navigate} />
              <Collapsible defaultOpen={workflowOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={workflowOpen} tooltip="Workflows">
                      <Workflow />
                      <span>Workflows</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {workflows.length === 0 ? (
                        <SidebarMenuSubItem>
                          <span className="block px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                            No workflows.
                          </span>
                        </SidebarMenuSubItem>
                      ) : (
                        workflows.map((workflow) => {
                          const active = workflow.policy.id === selectedWorkflowPolicyId;
                          return (
                            <SidebarMenuSubItem key={workflow.id}>
                              <SidebarMenuSubButton
                                size="sm"
                                isActive={active}
                                className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
                                onClick={() => selectWorkflow(workflow.policy.id)}
                              >
                                <span>{workflow.policy.name}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              {item("Agent runs", <Activity />, "/agent-runs", route.view === "agent-runs")}
              <Collapsible defaultOpen={agentsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={agentsOpen} tooltip="Agents">
                      <Bot />
                      <span>Agents</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarAgentList agents={agents} activePath={agentsOpen ? route.documentPath : undefined} navigate={navigate} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <Collapsible defaultOpen={eventsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={eventsOpen} tooltip="Events">
                      <Inbox />
                      <span>Events</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarDocumentList documents={eventDefinitions} activePath={eventsOpen ? route.documentPath : undefined} pathFor={eventDefinitionDocumentPath} navigate={navigate} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <SidebarProjectDirectoryMenu label="Goals" icon={<CheckCircle2 />} node={goalsDirectory} activePath={route.documentPath} navigate={navigate} />
              <Collapsible defaultOpen={policiesOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={policiesOpen} tooltip="Policies">
                      <GitBranch />
                      <span>Policies</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarDocumentList documents={policies} activePath={policiesOpen ? route.documentPath : undefined} pathFor={policyDocumentPath} navigate={navigate} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <Collapsible defaultOpen={runtimesOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={runtimesOpen} tooltip="Runtimes">
                      <Code2 />
                      <span>Runtimes</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarDocumentList documents={runtimes} activePath={runtimesOpen ? route.documentPath : undefined} pathFor={runtimeDocumentPath} navigate={navigate} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <Collapsible defaultOpen={skillsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={skillsOpen} tooltip="Skills">
                      <FileKey2 />
                      <span>Skills</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarDocumentList documents={skills} activePath={skillsOpen ? route.documentPath : undefined} pathFor={skillDocumentPath} navigate={navigate} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeSelector mode={themeMode} onChange={onThemeModeChange} />
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  );
}

export function App() {
  const [themeMode, setThemeMode] = useThemeMode();
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [route, setRoute] = useState<RouteState>(() => routeFromPath(`${window.location.pathname}${window.location.search}`));
  const [selectedProjectId, setSelectedProjectId] = useState(seedData.projects[0]?.id ?? "");
  const [selectedGoalId] = useState("");
  const [selectedAdrId] = useState("");

  const project = data.projects.find((item) => item.id === (route.projectId ?? selectedProjectId)) ?? data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0];
  const goals = useMemo(() => data.goals.filter((goal) => goal.projectId === project?.id), [data.goals, project?.id]);
  const adrs = useMemo(() => data.adrs.filter((adr) => adr.projectId === project?.id), [data.adrs, project?.id]);
  const activeWorkflowDefinitions = useMemo(
    () => data.eventDefinitions.filter((definition) => definition.active && definition.eventType),
    [data.eventDefinitions]
  );
  const workflows = useMemo(
    () => derivePolicyWorkflows(data.policies, activeWorkflowDefinitions),
    [activeWorkflowDefinitions, data.policies]
  );
  const [selectedWorkflowPolicyId, setSelectedWorkflowPolicyId] = useState("");
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0];
  const selectedAdr = adrs.find((adr) => adr.id === selectedAdrId) ?? adrs[0];
  const projectDocumentTree = data.projectDocumentTree ?? [];
  const selectedProjectDocument = useMemo(
    () => findProjectTreeDocument(projectDocumentTree, route.documentPath),
    [projectDocumentTree, route.documentPath]
  );
  const selectedAgent = useMemo(
    () => data.agents.find((agent) => agent.relativePath === route.documentPath) ?? data.agents[0],
    [data.agents, route.documentPath]
  );
  const selectedSkill = useMemo(
    () => data.skills.find((skill) => skill.relativePath === route.documentPath) ?? data.skills[0],
    [data.skills, route.documentPath]
  );
  const selectedRuntime = useMemo(
    () => data.runtimes.find((runtime) => runtime.relativePath === route.documentPath) ?? data.runtimes[0],
    [data.runtimes, route.documentPath]
  );
  const selectedPolicy = useMemo(
    () => data.policies.find((policy) => policy.relativePath === route.documentPath) ?? data.policies[0],
    [data.policies, route.documentPath]
  );
  const selectedEventDefinition = useMemo(
    () => data.eventDefinitions.find((definition) => definition.relativePath === route.documentPath) ?? data.eventDefinitions[0],
    [data.eventDefinitions, route.documentPath]
  );

  useEffect(() => {
    if (creatingWorkflow) return;
    const defaultWorkflowId = workflows.find((workflow) => workflow.outputEventType)?.policy.id ?? data.policies[0]?.id ?? "";
    if (!defaultWorkflowId) return;
    if (selectedWorkflowPolicyId && data.policies.some((policy) => policy.id === selectedWorkflowPolicyId)) return;
    setSelectedWorkflowPolicyId(defaultWorkflowId);
  }, [creatingWorkflow, data.policies, selectedWorkflowPolicyId, workflows]);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setRoute(routeFromPath(path));
  };

  const selectWorkflow = (policyId: string) => {
    setCreatingWorkflow(policyId === newWorkflowId);
    setSelectedWorkflowPolicyId(policyId);
    navigate("/workflow-orchestrator");
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.getData();
      setData(next);
      const routeProject = route.projectId ? next.projects.find((item) => item.id === route.projectId) : undefined;
      if (routeProject) {
        setSelectedProjectId(routeProject.id);
      } else if (!next.projects.some((item) => item.id === selectedProjectId)) {
        setSelectedProjectId(next.projects[0]?.id ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [route.projectId, selectedProjectId]);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(`${window.location.pathname}${window.location.search}`));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const source = new EventSource("/api/runtime/stream");
    const handleChange = () => {
      void refresh();
    };
    source.addEventListener("change", handleChange);
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.removeEventListener("change", handleChange);
      source.close();
    };
  }, [refresh]);

  useEffect(() => {
    if (route.projectId) setSelectedProjectId(route.projectId);
  }, [route.projectId]);

  const save = async <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => {
    const saved = await api.save(collection, item);
    await refresh();
    setNotice("Saved.");
    return saved;
  };

  const saveProjectDocument = async (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => {
    const saved = await api.saveProjectDocument(document);
    await refresh();
    setNotice("Saved.");
    return saved;
  };

  const remove = async (collection: SaveCollection | "events", id: string) => {
    await api.remove(collection, id);
    await refresh();
    setNotice("Deleted.");
  };

  const saveEventDefinition = async (eventDefinition: Partial<EventDefinition>) => {
    const saved = await api.saveEventDefinition(eventDefinition);
    await refresh();
    setNotice("Saved.");
    return saved;
  };

  const removeEventDefinition = async (id: string) => {
    await api.removeEventDefinition(id);
    await refresh();
    setNotice("Deleted.");
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectDocumentTree={projectDocumentTree}
          agents={data.agents}
          skills={data.skills}
          runtimes={data.runtimes}
          policies={data.policies}
          eventDefinitions={data.eventDefinitions}
          workflows={workflows}
          selectedWorkflowPolicyId={selectedWorkflowPolicyId}
          selectWorkflow={selectWorkflow}
          navigate={navigate}
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
        />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <main className="flex min-h-svh flex-col gap-4 bg-muted/30 p-3 md:p-4">
              <header className="flex flex-col gap-4 md:hidden">
                <div className="flex items-start gap-2">
                  <SidebarTrigger className="md:hidden">
                    <Menu />
                  </SidebarTrigger>
                </div>
              </header>

              {loading ? <Alert><AlertDescription>Loading workspace data...</AlertDescription></Alert> : null}
              {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
              {notice ? <Alert><AlertDescription>{notice}</AlertDescription></Alert> : null}

              {route.view === "projects" ? (
                <ProjectsOverview
                  project={project}
                  saveProjectDocument={saveProjectDocument}
                />
              ) : null}
              {route.view === "project-document" ? <ProjectDocumentPage document={selectedProjectDocument} saveProjectDocument={saveProjectDocument} /> : null}
              {route.view === "project-goals" ? <GoalsPage project={project} selectedGoal={selectedGoal} /> : null}
              {route.view === "project-adrs" ? <AdrsPage project={project} selectedAdr={selectedAdr} /> : null}
              {route.view === "workflow-orchestrator" ? (
                <WorkflowOrchestratorView
                  data={data}
                  activeDefinitions={activeWorkflowDefinitions}
                  workflows={workflows}
                  selectedPolicyId={selectedWorkflowPolicyId}
                  setSelectedPolicyId={setSelectedWorkflowPolicyId}
                  creatingWorkflow={creatingWorkflow}
                  setCreatingWorkflow={setCreatingWorkflow}
                  save={save}
                  remove={remove}
                  saveEventDefinition={saveEventDefinition}
                  removeEventDefinition={removeEventDefinition}
                />
              ) : null}
              {route.view === "agents" ? <AgentsView agent={selectedAgent} runtimes={data.runtimes} save={save} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "runtimes" ? <RuntimesView runtime={selectedRuntime} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "policies" ? <PoliciesView data={data} project={project} policy={selectedPolicy} save={save} remove={remove} /> : null}
              {route.view === "events" ? (
                <EventsView
                  data={data}
                  eventDefinition={selectedEventDefinition}
                  saveEventDefinition={saveEventDefinition}
                  removeEventDefinition={removeEventDefinition}
                  navigate={navigate}
                />
              ) : null}
              {route.view === "agent-runs" ? <AgentRunsView data={data} refresh={refresh} /> : null}
            </main>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function ProjectsOverview({
  project,
  saveProjectDocument
}: {
  project?: Project;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
}) {
  return (
    <ProjectMarkdownEditorView document={project} emptyTitle="No project document found." saveProjectDocument={saveProjectDocument} />
  );
}

function ProjectDocumentPage({
  document,
  saveProjectDocument
}: {
  document?: MarkdownDocument;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
}) {
  return (
    <ProjectMarkdownEditorView document={document} emptyTitle="No project document selected." saveProjectDocument={saveProjectDocument} />
  );
}

function ProjectMarkdownEditorView({
  document,
  emptyTitle,
  saveProjectDocument
}: {
  document?: MarkdownEntity;
  emptyTitle: string;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
}) {
  const formId = useId();
  const [frontmatterText, setFrontmatterText] = useState(frontmatterToYaml(document?.frontmatter));
  const [bodyText, setBodyText] = useState(document?.body ?? "");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFrontmatterText(frontmatterToYaml(document?.frontmatter));
    setBodyText(document?.body ?? "");
    setValidationError("");
  }, [document]);

  const handleSave = async () => {
    if (!document?.relativePath) return;

    try {
      const frontmatter = parseFrontmatterYaml(frontmatterText);
      setValidationError("");
      await saveProjectDocument({
        relativePath: document.relativePath,
        frontmatter,
        body: bodyText
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Invalid project document.");
    }
  };

  if (!document) return <EmptyState title={emptyTitle} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title="Edit Markdown"
        icon={<FileKey2 data-icon="inline-start" />}
        compact
        action={(
          <Button type="submit" size="icon-sm" form={formId} aria-label="Save Markdown" title="Save Markdown">
            <Save data-icon="inline-start" />
          </Button>
        )}
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          {validationError ? <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert> : null}
          <FieldGroup>
            <TextAreaField label="Frontmatter" rows={10} value={frontmatterText} onChange={setFrontmatterText} className="font-mono text-xs leading-relaxed" />
            <TextAreaField label="Markdown" rows={18} value={bodyText} onChange={setBodyText} className="font-mono text-xs leading-relaxed" />
          </FieldGroup>
        </form>
      </Panel>
      <Panel title="Preview" icon={<Eye data-icon="inline-start" />} compact>
        <MarkdownDocumentView document={document} emptyTitle={emptyTitle} compact embedded />
      </Panel>
    </div>
  );
}

function GoalsPage({ project, selectedGoal }: { project?: Project; selectedGoal?: Goal }) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading GOALS." />;

  return <MarkdownDocumentView document={selectedGoal} emptyTitle="No Goal document selected." />;
}

function AdrsPage({ project, selectedAdr }: { project?: Project; selectedAdr?: Adr }) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading ADRs." />;

  return <MarkdownDocumentView document={selectedAdr} emptyTitle="No ADR document selected." />;
}

function AgentsView({
  agent,
  runtimes,
  save
}: {
  agent?: Agent;
  runtimes: Runtime[];
  save: ViewProps["save"];
}) {
  const instructionsFormId = useId();
  const [savingSetting, setSavingSetting] = useState<"model" | "reasoning" | null>(null);
  const [instructionsText, setInstructionsText] = useState(agent?.instructions ?? "");
  const [savingInstructions, setSavingInstructions] = useState(false);

  useEffect(() => {
    setInstructionsText(agent?.instructions ?? "");
    setSavingInstructions(false);
  }, [agent?.id, agent?.instructions]);

  if (!agent) return <EmptyState title="No agent selected." />;

  const runtime = runtimes.find((candidate) => candidate.enabled) ?? runtimes[0];
  const runtimeLabel = runtime?.name || runtime?.type || "Codex";
  const modelValue = agent.model || (typeof agent.frontmatter?.model === "string" ? agent.frontmatter.model : "") || "gpt-5.5";
  const reasoningValue = agent.modelReasoningEffort || (typeof agent.frontmatter?.model_reasoning_effort === "string" ? agent.frontmatter.model_reasoning_effort : "") || "medium";
  const modelOptions = codexModelOptions.some((option) => option.value === modelValue)
    ? codexModelOptions
    : [{ value: modelValue, label: modelValue }, ...codexModelOptions];
  const reasoningOptions = reasoningEffortOptions.some((option) => option.value === reasoningValue)
    ? reasoningEffortOptions
    : [{ value: reasoningValue, label: reasoningValue }, ...reasoningEffortOptions];

  const updateAgentSetting = async (setting: "model" | "reasoning", patch: Partial<Agent>) => {
    setSavingSetting(setting);
    try {
      await save("agents", { ...agent, ...patch });
    } finally {
      setSavingSetting(null);
    }
  };

  const saveInstructions = async () => {
    setSavingInstructions(true);
    try {
      await save("agents", { ...agent, instructions: instructionsText });
    } finally {
      setSavingInstructions(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100svh-2rem)] gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="self-start overflow-hidden">
        <CardHeader className="gap-4 p-5">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent text-muted-foreground ring-1 ring-divider-strong">
            <Bot className="size-7" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-lg leading-tight">{agent.name}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{agent.description || "No description."}</CardDescription>
            <AgentStatusBadge status={agent.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 p-0">
          {agent.errors?.length ? (
            <section className="border-t border-divider-strong px-5 py-4 first:border-t-0">
              <h2 className="mb-3 font-mono text-[0.7rem] font-semibold uppercase leading-none text-section-heading">Errors</h2>
              <ErrorPreview errors={agent.errors} />
            </section>
          ) : null}
          <section className="border-t border-divider-strong px-5 py-4 first:border-t-0">
            <h2 className="mb-3.5 font-mono text-[0.7rem] font-semibold uppercase leading-none text-section-heading">Properties</h2>
            <dl className="flex flex-col gap-2.5">
              <AgentBadgeProperty label="Enabled">
                <AgentEnabledBadge enabled={agent.enabled} />
              </AgentBadgeProperty>
              <AgentProperty label="Runtime" value={runtimeLabel} icon={<Monitor aria-hidden="true" />} />
              <AgentSelectProperty
                label="Model"
                value={modelValue}
                options={modelOptions}
                icon={<Code2 aria-hidden="true" />}
                disabled={savingSetting !== null}
                onChange={(model) => void updateAgentSetting("model", { model })}
              />
              <AgentSelectProperty
                label="Reasoning effort"
                value={reasoningValue}
                options={reasoningOptions}
                icon={<Layers3 aria-hidden="true" />}
                disabled={savingSetting !== null}
                onChange={(modelReasoningEffort) => void updateAgentSetting("reasoning", { modelReasoningEffort })}
              />
            </dl>
          </section>
          <section className="border-t border-divider-strong px-5 py-4 first:border-t-0">
            <h2 className="mb-3.5 flex items-center gap-2 font-mono text-[0.7rem] font-semibold uppercase leading-none text-section-heading">
              Skills
              <span className="font-sans text-[0.7rem] font-normal text-muted-foreground">{agent.skills.length}</span>
            </h2>
            {agent.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {agent.skills.map((skill) => (
                  <Badge
                    key={`${skill.id}-${skill.metadata.path ?? ""}`}
                    variant="secondary"
                    className={cn(
                      "max-w-full justify-start rounded-md font-mono text-[0.68rem] font-normal",
                      skill.enabled === false && "border-border bg-transparent text-muted-foreground opacity-60"
                    )}
                    title={skill.enabled === false ? `${skill.name} disabled` : skill.name}
                  >
                    <span className="truncate">{skill.name}</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills attached.</p>
            )}
          </section>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="px-5 py-3 has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileKey2 className="size-3.5" aria-hidden="true" />
            Instructions
          </CardTitle>
          <CardAction className="col-start-1 row-span-1 row-start-2 justify-self-start self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end sm:self-center">
            <Button
              type="submit"
              size="icon-sm"
              form={instructionsFormId}
              disabled={savingInstructions || instructionsText === agent.instructions}
              aria-label={savingInstructions ? "Saving instructions" : "Save instructions"}
              title={savingInstructions ? "Saving instructions" : "Save instructions"}
            >
              <Save data-icon="inline-start" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-5">
          <form id={instructionsFormId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void saveInstructions(); }}>
            <FieldGroup>
              <Field>
                <FieldLabel>Markdown</FieldLabel>
                <Textarea
                  className="min-h-72 resize-y font-mono text-sm leading-relaxed"
                  value={instructionsText}
                  required
                  onChange={(event) => setInstructionsText(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <section className="flex flex-col gap-2.5">
              <h2 className="font-mono text-[0.7rem] font-semibold uppercase leading-none text-section-heading">Preview</h2>
              <ScrollArea className="h-[min(36svh,24rem)] rounded-lg border bg-background">
                <div className="agent-instructions-preview min-w-0 p-5 md:p-6">
                  <MarkdownBody source={instructionsText} title={agent.name} />
                </div>
              </ScrollArea>
            </section>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentProperty({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-foreground">
        <span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}

function AgentBadgeProperty({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function AgentSelectProperty({
  label,
  value,
  options,
  icon,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  icon: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-foreground">
        <span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger size="sm" className="h-7 min-w-0 max-w-full flex-1 justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </dd>
    </div>
  );
}

function SkillsView({
  skill,
  save,
  remove,
  navigate
}: {
  skill?: Skill;
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  navigate: (path: string) => void;
}) {
  const formId = useId();
  const [form, setForm] = useState<Partial<Skill>>(skill ?? skillTemplate());

  useEffect(() => {
    setForm(skill ?? skillTemplate());
  }, [skill]);

  const handleSave = async () => {
    const saved = await save("skills", form);
    if (saved.relativePath) navigate(skillDocumentPath(saved.relativePath));
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await remove("skills", form.id);
    navigate("/skills");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title={form.id ? "Update skill" : "Create skill"}
        icon={<FileKey2 data-icon="inline-start" />}
        action={<CrudActions formId={formId} newLabel="New" saveLabel="Save skill" id={form.id} onNew={() => setForm(skillTemplate())} onDelete={handleDelete} />}
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextAreaField label="Description" required value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <TextAreaField label="Markdown" rows={14} value={form.body ?? ""} onChange={(body) => setForm({ ...form, body })} />
          </FieldGroup>
        </form>
      </Panel>
      <Panel title="Preview" icon={<Eye data-icon="inline-start" />} compact>
        <MarkdownDocumentView document={skill} emptyTitle="No skill selected." embedded />
      </Panel>
    </div>
  );
}

function RuntimesView({
  runtime,
  save,
  remove,
  navigate
}: Omit<ViewProps, "data"> & {
  runtime?: Runtime;
  navigate: (path: string) => void;
}) {
  const formId = useId();
  const [form, setForm] = useState<Partial<Runtime>>(runtime ?? runtimeTemplate());
  const [configText, setConfigText] = useState(toKeyValueLines((runtime ?? runtimeTemplate()).config ?? {}));

  useEffect(() => {
    const next = runtime ?? runtimeTemplate();
    setForm(next);
    setConfigText(toKeyValueLines(next.config ?? {}));
  }, [runtime]);

  const handleSave = async () => {
    const saved = await save("runtimes", { ...form, config: fromKeyValueLines(configText) });
    if (saved.relativePath) navigate(runtimeDocumentPath(saved.relativePath));
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await remove("runtimes", form.id);
    navigate("/runtimes");
  };

  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <Panel
        title={form.id ? "Update runtime" : "Create runtime"}
        icon={<Code2 data-icon="inline-start" />}
        action={(
          <CrudActions
            formId={formId}
            newLabel="New Codex CLI runtime"
            saveLabel="Save runtime"
            id={form.id}
            leading={<SwitchField label="Enabled" checked={form.enabled ?? true} onChange={(enabled) => setForm({ ...form, enabled })} />}
            onNew={() => { setForm(runtimeTemplate()); setConfigText(toKeyValueLines(runtimeTemplate().config ?? {})); }}
            onDelete={handleDelete}
          />
        )}
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <SelectField
              label="Type"
              value={form.type ?? "codex-cli"}
              options={[{ value: "codex-cli", label: "Codex CLI" }, { value: "custom", label: "Custom" }]}
              onChange={(type) => setForm({ ...form, type: type as Runtime["type"] })}
            />
            <TextField label="Command" required value={form.command ?? ""} onChange={(command) => setForm({ ...form, command })} />
            <TextAreaField label="Config (key=value)" rows={6} value={configText} onChange={setConfigText} />
          </FieldGroup>
        </form>
      </Panel>
    </div>
  );
}

const workflowNodeConfig: Record<WorkflowNodeId, {
  label: string;
  icon: LucideIcon;
}> = {
  input: {
    label: "INPUT EVENT",
    icon: Inbox
  },
  policy: {
    label: "POLICY",
    icon: GitBranch
  },
  agent: {
    label: "AGENT",
    icon: Bot
  },
  output: {
    label: "OUTPUT EVENT",
    icon: Route
  }
};

const workflowEventOptions = (definitions: EventDefinition[]) =>
  definitions.map((definition) => ({
    value: definition.eventType,
    label: `${definition.eventType} · ${definition.name}`
  }));

const workflowAgentOptions = (agents: Agent[]) =>
  agents.map((agent) => ({
    value: agent.id,
    label: `${agent.name}${agent.enabled ? "" : " · disabled"}`
  }));

const workflowPolicyOptions = (policies: Policy[]) => [
  { value: newWorkflowId, label: "Create new policy" },
  ...policies.map((policy) => ({
    value: policy.id,
    label: policy.name
  }))
];

const workflowFallbackPolicyName = (inputEventType: string, agentName: string) =>
  inputEventType && agentName ? `Route ${inputEventType} to ${agentName}` : "New workflow policy";

function WorkflowNode({
  node,
  selected,
  value,
  options,
  onChange,
  onSelect,
  headerActions,
  children
}: {
  node: WorkflowNodeId;
  selected: boolean;
  value: string;
  options?: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
  onSelect: () => void;
  headerActions?: ReactNode;
  children?: ReactNode;
}) {
  const config = workflowNodeConfig[node];
  const Icon = config.icon;
  const hasSelect = Boolean(options && onChange);

  return (
    <div
      className={cn(
        "flex min-h-20 w-full min-w-0 flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground transition",
        selected && "border-ring bg-accent ring-2 ring-ring/30"
      )}
    >
      <div className={cn("grid items-start gap-2", headerActions ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1")}>
        <button
          type="button"
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-pressed={selected}
          onClick={onSelect}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-[0.7rem] font-semibold uppercase leading-none tracking-normal text-foreground">{config.label}</span>
        </button>
        {headerActions ? <div className="shrink-0 justify-self-end">{headerActions}</div> : null}
      </div>
      {hasSelect && options ? (
        options.length > 0 ? (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-8 w-full min-w-0 px-2 text-xs shadow-none [&>span]:truncate">
              <SelectValue placeholder="Not selected" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span className="flex h-8 w-full items-center justify-center rounded-md border border-border bg-background px-2 text-xs text-muted-foreground">
            No options
          </span>
        )
      ) : (
        <span className="max-w-full truncate font-mono text-[0.68rem] leading-none text-muted-foreground">{value || "Not selected"}</span>
      )}
      {children ? <div className="min-w-0 border-t border-divider-strong pt-3">{children}</div> : null}
    </div>
  );
}

function WorkflowAgentEditor({
  agent,
  runtimes,
  save,
  remove,
  onSaved,
  onNew,
  onDeleted,
  renderEmbedded
}: {
  agent?: Agent;
  runtimes: Runtime[];
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
  renderEmbedded?: (parts: { actions: ReactNode; content: ReactNode }) => ReactNode;
}) {
  const formId = useId();
  const instructionsId = useId();
  const [form, setForm] = useState<Partial<Agent>>(agent ?? agentTemplate());
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(agent ?? agentTemplate());
    setError("");
  }, [agent]);

  const frontmatterRuntime = typeof form.frontmatter?.runtime === "string" ? form.frontmatter.runtime : "";
  const runtime = runtimes.find((candidate) => candidate.id === frontmatterRuntime || candidate.name === frontmatterRuntime) ?? runtimes.find((candidate) => candidate.enabled) ?? runtimes[0];
  const runtimeValue = runtime?.id ?? "";
  const runtimeOptions = runtimes.map((candidate) => ({ value: candidate.id, label: candidate.name || candidate.type }));
  const modelValue = form.model || (typeof form.frontmatter?.model === "string" ? form.frontmatter.model : "") || "gpt-5.5";
  const reasoningValue = form.modelReasoningEffort || (typeof form.frontmatter?.model_reasoning_effort === "string" ? form.frontmatter.model_reasoning_effort : "") || "medium";
  const modelOptions = codexModelOptions.some((option) => option.value === modelValue)
    ? codexModelOptions
    : [{ value: modelValue, label: modelValue }, ...codexModelOptions];
  const reasoningOptions = reasoningEffortOptions.some((option) => option.value === reasoningValue)
    ? reasoningEffortOptions
    : [{ value: reasoningValue, label: reasoningValue }, ...reasoningEffortOptions];

  const updateForm = (patch: Partial<Agent>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const updateRuntime = (runtimeId: string) => {
    updateForm({ frontmatter: { ...form.frontmatter, runtime: runtimeId } });
  };

  const newAgent = () => {
    setForm(agentTemplate());
    setError("");
    onNew?.();
  };

  const submit = async () => {
    setError("");
    try {
      const name = form.name?.trim();
      if (!name) throw new Error("Agent name is required.");
      const saved = await save("agents", {
        ...form,
        name,
        description: form.description ?? "",
        instructions: form.instructions ?? "",
        skills: form.skills ?? [],
        enabled: form.enabled ?? true,
        status: form.status ?? "offline",
        model: modelValue,
        modelReasoningEffort: reasoningValue
      });
      setForm(saved);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save agent.");
    }
  };

  const deleteAgent = async () => {
    if (!form.id) return;
    const deletedId = form.id;
    await remove("agents", deletedId);
    setForm(agentTemplate());
    setError("");
    onDeleted?.(deletedId);
  };

  const actions = (
    <CrudActions
      formId={formId}
      newLabel="New"
      saveLabel="Save agent"
      id={form.id}
      disabled={!form.name?.trim()}
      onNew={newAgent}
      onDelete={() => void deleteAgent()}
    />
  );

  const content = (
    <div className="grid gap-3">
      {form.errors?.length ? <ErrorPreview errors={form.errors} /> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <form id={formId} className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
            <Select value={runtimeValue} onValueChange={updateRuntime} disabled={runtimeOptions.length === 0}>
              <SelectTrigger size="sm" className="h-7 min-w-0 flex-[1_1_5.5rem] justify-between px-2">
                <SelectValue placeholder="No runtime" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {runtimeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={modelValue} onValueChange={(model) => updateForm({ model })}>
              <SelectTrigger size="sm" className="h-7 min-w-0 flex-[1_1_4.75rem] justify-between px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {modelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className={cn("shrink-0", reasoningEffortTone(reasoningValue))}
              aria-label={`Reasoning effort: ${reasoningOptions.find((option) => option.value === reasoningValue)?.label ?? reasoningValue}`}
              title={`Reasoning effort: ${reasoningOptions.find((option) => option.value === reasoningValue)?.label ?? reasoningValue}`}
              onClick={() => updateForm({ modelReasoningEffort: nextReasoningEffort(reasoningValue) })}
            >
              <ChartNoAxesColumnIncreasing data-icon="inline-start" />
            </Button>
        </div>
        <FieldGroup>
          <TextField label="Name" required compact value={form.name ?? ""} onChange={(name) => updateForm({ name })} />
          <TextAreaField label="Description" rows={2} compact value={form.description ?? ""} onChange={(description) => updateForm({ description })} />
        </FieldGroup>
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={instructionsId} className="text-muted-foreground">Instructions</FieldLabel>
            <Textarea
              id={instructionsId}
              className="min-h-40 resize-y font-mono text-xs leading-relaxed"
              value={form.instructions ?? ""}
              required
              onChange={(event) => updateForm({ instructions: event.target.value })}
            />
          </Field>
        </FieldGroup>
      </form>
    </div>
  );

  if (renderEmbedded) return renderEmbedded({ actions, content });

  return (
    <div className="grid gap-3">
      {actions}
      {content}
    </div>
  );
}

function WorkflowOrchestratorView({
  data,
  activeDefinitions,
  workflows,
  selectedPolicyId,
  setSelectedPolicyId,
  creatingWorkflow,
  setCreatingWorkflow,
  save,
  remove,
  saveEventDefinition,
  removeEventDefinition
}: {
  data: AppData;
  activeDefinitions: EventDefinition[];
  workflows: PolicyWorkflow[];
  selectedPolicyId: string;
  setSelectedPolicyId: (policyId: string) => void;
  creatingWorkflow: boolean;
  setCreatingWorkflow: (creating: boolean) => void;
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  saveEventDefinition: (eventDefinition: Partial<EventDefinition>) => Promise<EventDefinition>;
  removeEventDefinition: (id: string) => Promise<void>;
}) {
  const [selectedNode, setSelectedNode] = useState<WorkflowNodeId>("input");
  const [error, setError] = useState("");

  const selectedPolicy = data.policies.find((policy) => policy.id === selectedPolicyId);
  const defaultPolicyId = workflows.find((workflow) => workflow.outputEventType)?.policy.id ?? data.policies[0]?.id ?? newWorkflowId;
  const agentById = useMemo(() => new Map(data.agents.map((agent) => [agent.id, agent])), [data.agents]);
  const definitionByEventType = useMemo(
    () => new Map(data.eventDefinitions.map((definition) => [definition.eventType, definition])),
    [data.eventDefinitions]
  );

  const buildDraft = useCallback((policy?: Policy): WorkflowDraftState => {
    const targetAgentId = policy ? targetAgentIdForWorkflowPolicy(policy) : data.agents[0]?.id ?? "";
    const inputEventType = policy
      ? eventTypesForWorkflowPolicy(policy)[0] ?? activeDefinitions[0]?.eventType ?? ""
      : activeDefinitions[0]?.eventType ?? "";
    const mappedOutputEventType = findOutputEventDefinition(targetAgentId, activeDefinitions)?.eventType;
    const outputEventType = mappedOutputEventType ?? (policy
      ? ""
      : activeDefinitions.find((definition) => definition.eventType !== inputEventType)?.eventType ?? activeDefinitions[0]?.eventType ?? "");

    return {
      policyId: policy?.id,
      policyName: policy?.name ?? "",
      policyDescription: policy?.description ?? "",
      policyActive: policy?.active ?? true,
      inputEventType,
      targetAgentId,
      outputEventType
    };
  }, [activeDefinitions, data.agents]);

  const [draft, setDraft] = useState<WorkflowDraftState>(() => buildDraft(data.policies[0]));

  useEffect(() => {
    if (creatingWorkflow) return;
    if (data.policies.length === 0) {
      setSelectedPolicyId(newWorkflowId);
      return;
    }
    if (!selectedPolicyId || selectedPolicyId === newWorkflowId) {
      setSelectedPolicyId(defaultPolicyId);
      return;
    }
    if (selectedPolicyId && data.policies.some((policy) => policy.id === selectedPolicyId)) return;
    setSelectedPolicyId(defaultPolicyId);
  }, [creatingWorkflow, data.policies, defaultPolicyId, selectedPolicyId]);

  useEffect(() => {
    if (selectedPolicyId === newWorkflowId && creatingWorkflow) {
      setDraft(buildDraft());
      setSelectedNode("input");
      setError("");
      return;
    }
    if (selectedPolicyId === newWorkflowId) return;
    setDraft(buildDraft(selectedPolicy));
    setError("");
  }, [buildDraft, creatingWorkflow, selectedPolicy, selectedPolicyId]);

  const inputDefinition = definitionByEventType.get(draft.inputEventType);
  const outputDefinition = definitionByEventType.get(draft.outputEventType);
  const targetAgent = agentById.get(draft.targetAgentId);
  const canSave = Boolean(draft.inputEventType && draft.targetAgentId && draft.outputEventType);
  const eventOptions = workflowEventOptions(activeDefinitions);
  const policyOptions = workflowPolicyOptions(data.policies);
  const agentOptions = workflowAgentOptions(data.agents);

  const updateDraft = (patch: Partial<WorkflowDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const selectInputEvent = (inputEventType: string) => {
    setSelectedNode("input");
    updateDraft({ inputEventType });
  };

  const selectPolicy = (policyId: string) => {
    setSelectedPolicyId(policyId);
    setSelectedNode("policy");
    if (policyId === newWorkflowId) {
      setCreatingWorkflow(true);
      setDraft(buildDraft());
      setError("");
    } else {
      setCreatingWorkflow(false);
    }
  };

  const selectAgent = (targetAgentId: string) => {
    setSelectedNode("agent");
    const nextOutput = findOutputEventDefinition(targetAgentId, activeDefinitions)?.eventType ?? draft.outputEventType;
    updateDraft({ targetAgentId, outputEventType: nextOutput });
  };

  const selectOutputEvent = (outputEventType: string) => {
    setSelectedNode("output");
    updateDraft({ outputEventType });
  };

  const buildWorkflowPolicyDraft = useCallback((): Partial<Policy> => {
    const agentName = agentById.get(draft.targetAgentId)?.name ?? draft.targetAgentId;
    const fallbackDescription = draft.inputEventType && agentName ? `Route ${draft.inputEventType} to ${agentName}.` : "";

    return applyWorkflowToPolicy({
      ...policyTemplate(draft.targetAgentId),
      name: draft.policyName.trim() || workflowFallbackPolicyName(draft.inputEventType, agentName),
      description: draft.policyDescription.trim() || fallbackDescription,
      active: draft.policyActive
    }, draft);
  }, [agentById, draft]);

  const embeddedPolicy = useMemo<Partial<Policy>>(() => {
    if (selectedPolicyId === newWorkflowId || !selectedPolicy) return buildWorkflowPolicyDraft();
    return applyWorkflowToPolicy({
      ...selectedPolicy,
      name: draft.policyName.trim() || selectedPolicy.name,
      description: draft.policyDescription,
      active: draft.policyActive
    }, draft);
  }, [buildWorkflowPolicyDraft, draft, selectedPolicy, selectedPolicyId]);

  const handleEmbeddedPolicySaved = (policy: Policy) => {
    const nextTargetAgentId = targetAgentIdForWorkflowPolicy(policy);
    setCreatingWorkflow(false);
    setSelectedPolicyId(policy.id);
    setDraft((current) => ({
      ...current,
      policyId: policy.id,
      policyName: policy.name,
      policyDescription: policy.description,
      policyActive: policy.active,
      inputEventType: eventTypesForWorkflowPolicy(policy)[0] ?? current.inputEventType,
      targetAgentId: nextTargetAgentId || current.targetAgentId
    }));
  };

  const handleEmbeddedPolicyDraftChange = (policyDraft: Partial<Policy>, selectedEventType: string) => {
    const nextTargetAgentId = policyTargetForForm(policyDraft, data.agents[0]?.id ?? "");
    const nextOutputEventType = nextTargetAgentId !== draft.targetAgentId
      ? findOutputEventDefinition(nextTargetAgentId, activeDefinitions)?.eventType ?? draft.outputEventType
      : draft.outputEventType;

    updateDraft({
      policyName: policyDraft.name ?? "",
      policyDescription: policyDraft.description ?? "",
      policyActive: policyDraft.active ?? true,
      inputEventType: selectedEventType,
      targetAgentId: nextTargetAgentId,
      outputEventType: nextOutputEventType
    });
  };

  const handleInputEventSaved = (definition: EventDefinition) => {
    updateDraft({ inputEventType: definition.eventType });
  };

  const handleOutputEventSaved = (definition: EventDefinition) => {
    updateDraft({ outputEventType: definition.eventType });
  };

  const handleAgentSaved = (agent: Agent) => {
    updateDraft({
      targetAgentId: agent.id,
      outputEventType: findOutputEventDefinition(agent.id, activeDefinitions)?.eventType ?? draft.outputEventType
    });
  };

  const handleAgentDeleted = (agentId: string) => {
    const nextAgent = data.agents.find((candidate) => candidate.id !== agentId);
    updateDraft({
      targetAgentId: nextAgent?.id ?? "",
      outputEventType: nextAgent ? findOutputEventDefinition(nextAgent.id, activeDefinitions)?.eventType ?? draft.outputEventType : draft.outputEventType
    });
  };

  const saveWorkflow = async () => {
    setError("");
    try {
      if (!draft.inputEventType) throw new Error("Select an input event.");
      if (!draft.targetAgentId) throw new Error("Select an agent.");
      if (!draft.outputEventType) throw new Error("Select an output event.");

      const output = definitionByEventType.get(draft.outputEventType);
      if (!output) throw new Error("Selected output event is not available.");

      const agentName = agentById.get(draft.targetAgentId)?.name ?? draft.targetAgentId;
      const fallbackDescription = `Route ${draft.inputEventType} to ${agentName}.`;
      const isNewWorkflow = selectedPolicyId === newWorkflowId || !selectedPolicy;
      const basePolicy = selectedPolicyId === newWorkflowId || !selectedPolicy
        ? policyTemplate(draft.targetAgentId)
        : selectedPolicy;
      const savedPolicy = await save("policies", applyWorkflowToPolicy({
        ...basePolicy,
        name: draft.policyName.trim() || basePolicy.name || workflowFallbackPolicyName(draft.inputEventType, agentName),
        description: isNewWorkflow ? draft.policyDescription.trim() || fallbackDescription : draft.policyDescription,
        active: draft.policyActive
      }, draft));

      await saveEventDefinition(mergeReadyProducer(output, draft.targetAgentId));
      setCreatingWorkflow(false);
      setSelectedPolicyId(savedPolicy.id);
      setDraft((current) => ({
        ...current,
        policyId: savedPolicy.id,
        policyName: savedPolicy.name,
        policyDescription: savedPolicy.description,
        policyActive: savedPolicy.active
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save workflow.");
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="gap-1.5 px-4 py-3 has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow data-icon="inline-start" />
            Workflows
          </CardTitle>
          <CardAction className="col-start-1 row-span-1 row-start-2 justify-self-start self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end sm:self-center">
            <div className="flex items-center justify-start gap-2 sm:justify-end">
              <SwitchField label="Enabled" checked={draft.policyActive} onChange={(policyActive) => updateDraft({ policyActive })} />
              <Button
                type="button"
                size="icon-sm"
                disabled={!canSave}
                className="shrink-0"
                aria-label="Save workflow"
                title="Save workflow"
                onClick={() => void saveWorkflow()}
              >
                <Save data-icon="inline-start" />
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid gap-4 p-4">
            {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <EventDefinitionEditor
                key={`workflow-input-${inputDefinition?.id ?? "new"}`}
                variant="embedded"
                showCatalogWarnings={false}
                data={data}
                eventDefinition={inputDefinition}
                saveEventDefinition={saveEventDefinition}
                removeEventDefinition={removeEventDefinition}
                onSaved={handleInputEventSaved}
                onNew={() => updateDraft({ inputEventType: "" })}
                onDeleted={() => updateDraft({ inputEventType: "" })}
                renderEmbedded={({ actions, content }) => (
                  <WorkflowNode
                    node="input"
                    selected={selectedNode === "input"}
                    value={draft.inputEventType}
                    options={eventOptions}
                    onChange={selectInputEvent}
                    onSelect={() => setSelectedNode("input")}
                    headerActions={actions}
                  >
                    {content}
                  </WorkflowNode>
                )}
              />
              <PolicyEditor
                variant="embedded"
                data={data}
                policy={embeddedPolicy}
                save={save}
                remove={remove}
                newPolicyTemplate={buildWorkflowPolicyDraft}
                onSaved={handleEmbeddedPolicySaved}
                onDraftChange={handleEmbeddedPolicyDraftChange}
                renderEmbedded={({ actions, content }) => (
                  <WorkflowNode
                    node="policy"
                    selected={selectedNode === "policy"}
                    value={draft.policyId ?? selectedPolicyId}
                    options={policyOptions}
                    onChange={selectPolicy}
                    onSelect={() => setSelectedNode("policy")}
                    headerActions={actions}
                  >
                    {content}
                  </WorkflowNode>
                )}
              />
              <WorkflowAgentEditor
                agent={targetAgent}
                runtimes={data.runtimes}
                save={save}
                remove={remove}
                onSaved={handleAgentSaved}
                onNew={() => updateDraft({ targetAgentId: "" })}
                onDeleted={handleAgentDeleted}
                renderEmbedded={({ actions, content }) => (
                  <WorkflowNode
                    node="agent"
                    selected={selectedNode === "agent"}
                    value={draft.targetAgentId}
                    options={agentOptions}
                    onChange={selectAgent}
                    onSelect={() => setSelectedNode("agent")}
                    headerActions={actions}
                  >
                    {content}
                  </WorkflowNode>
                )}
              />
              <EventDefinitionEditor
                key={`workflow-output-${outputDefinition?.id ?? "new"}`}
                variant="embedded"
                showCatalogWarnings={false}
                data={data}
                eventDefinition={outputDefinition}
                saveEventDefinition={saveEventDefinition}
                removeEventDefinition={removeEventDefinition}
                onSaved={handleOutputEventSaved}
                onNew={() => updateDraft({ outputEventType: "" })}
                onDeleted={() => updateDraft({ outputEventType: "" })}
                renderEmbedded={({ actions, content }) => (
                  <WorkflowNode
                    node="output"
                    selected={selectedNode === "output"}
                    value={draft.outputEventType}
                    options={eventOptions}
                    onChange={selectOutputEvent}
                    onSelect={() => setSelectedNode("output")}
                    headerActions={actions}
                  >
                    {content}
                  </WorkflowNode>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PoliciesView(props: ViewProps & {
  project?: Project;
  policy?: Partial<Policy>;
  newPolicyTemplate?: () => Partial<Policy>;
  onSaved?: (policy: Policy) => void;
  renderEmbedded?: (parts: { actions: ReactNode; content: ReactNode }) => ReactNode;
}) {
  return <PolicyEditor {...props} />;
}

function PolicyEditor({
  data,
  policy,
  save,
  remove,
  newPolicyTemplate,
  onSaved,
  onDraftChange,
  renderEmbedded,
  variant = "panel"
}: ViewProps & {
  project?: Project;
  policy?: Partial<Policy>;
  newPolicyTemplate?: () => Partial<Policy>;
  onSaved?: (policy: Policy) => void;
  onDraftChange?: (policy: Partial<Policy>, selectedEventType: string) => void;
  renderEmbedded?: (parts: { actions: ReactNode; content: ReactNode }) => ReactNode;
  variant?: "panel" | "embedded";
}) {
  const formId = useId();
  const embedded = variant === "embedded";
  const activeDefinitions = useMemo(
    () => data.eventDefinitions.filter((definition) => definition.active && definition.eventType),
    [data.eventDefinitions]
  );
  const createPolicyTemplate = useCallback(
    () => newPolicyTemplate ? newPolicyTemplate() : policyTemplate(data.agents[0]?.id ?? ""),
    [data.agents, newPolicyTemplate]
  );
  const [form, setForm] = useState<Partial<Policy>>(policy ?? createPolicyTemplate());
  const [selectedEventType, setSelectedEventType] = useState(eventTypesForPolicy(policy ?? {})[0] ?? "");
  const [advancedMatchText, setAdvancedMatchText] = useState("");
  const [error, setError] = useState("");
  const activeEventTypeSet = useMemo(() => new Set(activeDefinitions.map((definition) => definition.eventType)), [activeDefinitions]);
  const invalidSelectedEventType = selectedEventType && !activeEventTypeSet.has(selectedEventType) ? selectedEventType : "";

  useEffect(() => {
    const next = policy ?? createPolicyTemplate();
    const nextEventTypes = eventTypesForPolicy(next);
    setForm(next);
    setSelectedEventType(nextEventTypes[0] ?? activeDefinitions[0]?.eventType ?? "");
    setAdvancedMatchText(readJson(advancedPolicyMatchForForm(next)));
    setError("");
  }, [activeDefinitions, createPolicyTemplate, policy]);

  const updateForm = (patch: Partial<Policy>, nextSelectedEventType = selectedEventType) => {
    const next = { ...form, ...patch };
    setForm(next);
    onDraftChange?.(next, nextSelectedEventType);
  };

  const updateSelectedEventType = (nextSelectedEventType: string) => {
    setSelectedEventType(nextSelectedEventType);
    onDraftChange?.(form, nextSelectedEventType);
  };

  const newPolicy = () => {
    const next = createPolicyTemplate();
    const nextSelectedEventType = eventTypesForPolicy(next)[0] ?? activeDefinitions[0]?.eventType ?? "";
    setForm(next);
    setSelectedEventType(nextSelectedEventType);
    setAdvancedMatchText(readJson(advancedPolicyMatchForForm(next)));
    setError("");
    onDraftChange?.(next, nextSelectedEventType);
  };

  const submit = async () => {
    setError("");
    try {
      if (!selectedEventType) throw new Error("Select exactly one event type for this policy.");
      const advancedMatch = parsePolicyMatch(advancedMatchText);
      delete advancedMatch.eventTypes;
      const match = { ...advancedMatch, eventTypes: [selectedEventType] };
      const targetAgentId = policyTargetForForm(form, data.agents[0]?.id ?? "");
      const saved = await save("policies", {
        ...form,
        match,
        action: { type: "start_agent_run", targetAgentId },
        targetAgentId,
        projectId: typeof match.projectId === "string" ? match.projectId : "*",
        source: typeof match.source === "string" ? match.source : "*",
        eventTypes: match.eventTypes ?? [],
        payloadMetadata: {}
      });
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save policy.");
    }
  };

  const actions = (
    <CrudActions
      formId={formId}
      newLabel="New"
      saveLabel="Save policy"
      id={form.id}
      disabled={data.agents.length === 0 || activeDefinitions.length === 0 || !selectedEventType || Boolean(invalidSelectedEventType)}
      leading={embedded ? undefined : <SwitchField label="Enabled" checked={form.active ?? true} onChange={(active) => updateForm({ active })} />}
      onNew={newPolicy}
      onDelete={() => void remove("policies", form.id!)}
    />
  );

  const content = (
    <>
      {form.errors?.length ? <ErrorPreview errors={form.errors} /> : null}
      {invalidSelectedEventType ? (
        <Alert variant="destructive">
          <AlertDescription>
            Policy references an event type that is not active in the event catalog: {invalidSelectedEventType}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <form id={formId} className={cn("flex flex-col gap-4", embedded && "gap-3")} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <FieldGroup>
          <TextField label="Name" required compact={embedded} value={form.name ?? ""} onChange={(name) => updateForm({ name })} />
          <TextAreaField label="Description" rows={embedded ? 2 : 3} compact={embedded} value={form.description ?? ""} onChange={(description) => updateForm({ description })} />
          <SelectField
            label="Target agent"
            value={policyTargetForForm(form, data.agents[0]?.id ?? "")}
            options={data.agents.map((agent) => ({ value: agent.id, label: agent.name }))}
            onChange={(targetAgentId) => updateForm({ targetAgentId, action: { type: "start_agent_run", targetAgentId } })}
            compact={embedded}
          />
          {activeDefinitions.length === 0 ? (
            <EmptyState title="No active event definitions." action="Create an active event before saving policies." />
          ) : (
            <SelectField
              label="Handled event type"
              value={selectedEventType}
              options={[
                ...activeDefinitions.map((definition) => ({ value: definition.eventType, label: `${definition.eventType} · ${definition.name}` })),
                ...(invalidSelectedEventType ? [{ value: invalidSelectedEventType, label: `${invalidSelectedEventType} · unavailable` }] : [])
              ]}
              onChange={updateSelectedEventType}
              compact={embedded}
            />
          )}
          <TextAreaField label="Advanced match JSON" rows={embedded ? 5 : 8} compact={embedded} value={advancedMatchText} onChange={setAdvancedMatchText} />
        </FieldGroup>
      </form>
    </>
  );

  if (embedded) {
    if (renderEmbedded) return renderEmbedded({ actions, content });

    return (
      <div className="grid gap-3">
        {actions}
        {content}
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <Panel title={form.id ? "Update policy" : "Create policy"} icon={<GitBranch data-icon="inline-start" />} action={actions}>
        {content}
      </Panel>
    </div>
  );
}

function EventsView(props: {
  data: AppData;
  eventDefinition?: EventDefinition;
  saveEventDefinition: (eventDefinition: Partial<EventDefinition>) => Promise<EventDefinition>;
  removeEventDefinition: (id: string) => Promise<void>;
  navigate?: (path: string) => void;
  onSaved?: (eventDefinition: EventDefinition) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
  renderEmbedded?: (parts: { actions: ReactNode; content: ReactNode }) => ReactNode;
}) {
  return <EventDefinitionEditor {...props} />;
}

function EventDefinitionEditor({
  data,
  eventDefinition,
  saveEventDefinition,
  removeEventDefinition,
  navigate,
  onSaved,
  onNew,
  onDeleted,
  renderEmbedded,
  variant = "panel",
  showCatalogWarnings = true
}: {
  data: AppData;
  eventDefinition?: EventDefinition;
  saveEventDefinition: (eventDefinition: Partial<EventDefinition>) => Promise<EventDefinition>;
  removeEventDefinition: (id: string) => Promise<void>;
  navigate?: (path: string) => void;
  onSaved?: (eventDefinition: EventDefinition) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
  renderEmbedded?: (parts: { actions: ReactNode; content: ReactNode }) => ReactNode;
  variant?: "panel" | "embedded";
  showCatalogWarnings?: boolean;
}) {
  const formId = useId();
  const embedded = variant === "embedded";
  const [definitionForm, setDefinitionForm] = useState<Partial<EventDefinition>>(eventDefinition ?? eventDefinitionTemplate());
  const [producersText, setProducersText] = useState(readJson(definitionForm.producers ?? []));
  const [payloadExampleText, setPayloadExampleText] = useState(readJson(definitionForm.payloadExample ?? {}));
  const [definitionError, setDefinitionError] = useState("");

  const activeEventTypes = useMemo(
    () => new Set(data.eventDefinitions.filter((definition) => definition.active).map((definition) => definition.eventType)),
    [data.eventDefinitions]
  );
  const missingPolicyEventTypes = useMemo(() => {
    const policyTypes = data.policies.flatMap((policy) => policy.match?.eventTypes ?? policy.eventTypes ?? []);
    return [...new Set(policyTypes)].filter((eventType) => eventType && !activeEventTypes.has(eventType));
  }, [activeEventTypes, data.policies]);

  useEffect(() => {
    const next = eventDefinition ?? eventDefinitionTemplate();
    setDefinitionForm(next);
    setProducersText(readJson(next.producers ?? []));
    setPayloadExampleText(readJson(next.payloadExample ?? {}));
    setDefinitionError("");
  }, [eventDefinition]);

  const saveDefinition = async () => {
    setDefinitionError("");
    try {
      const saved = await saveEventDefinition({
        ...definitionForm,
        source: definitionForm.source ?? eventDefinition?.source ?? eventDefinitionTemplate().source,
        tags: definitionForm.tags ?? [],
        producers: parseEventProducers(producersText),
        payloadExample: parsePayload(payloadExampleText)
      });
      onSaved?.(saved);
      if (!onSaved && saved.relativePath) navigate?.(eventDefinitionDocumentPath(saved.relativePath));
    } catch (err) {
      setDefinitionError(err instanceof Error ? err.message : "Unable to save event definition.");
    }
  };

  const newDefinition = () => {
    const next = eventDefinitionTemplate();
    setDefinitionForm(next);
    setProducersText(readJson(next.producers ?? []));
    setPayloadExampleText(readJson(next.payloadExample ?? {}));
    setDefinitionError("");
    if (onNew) onNew();
    else navigate?.("/events");
  };

  const actions = (
    <CrudActions
      formId={formId}
      newLabel="New"
      saveLabel="Save definition"
      id={definitionForm.id}
      leading={embedded ? undefined : <SwitchField label="Enabled" checked={definitionForm.active ?? true} onChange={(active) => setDefinitionForm({ ...definitionForm, active })} />}
      onNew={newDefinition}
      onDelete={() => {
        if (!definitionForm.id) return;
        void removeEventDefinition(definitionForm.id).then(() => {
          onDeleted?.(definitionForm.id!);
          if (!onDeleted) navigate?.("/events");
        });
      }}
    />
  );

  const content = (
    <>
      {definitionForm.errors?.length ? <ErrorPreview errors={definitionForm.errors} /> : null}
      {definitionError ? <Alert variant="destructive"><AlertDescription>{definitionError}</AlertDescription></Alert> : null}
      <form id={formId} className={cn("flex flex-col gap-4", embedded ? "gap-3" : "mt-4")} onSubmit={(event) => { event.preventDefault(); void saveDefinition(); }}>
        <FieldGroup>
          <TextField label="Name" required compact={embedded} value={definitionForm.name ?? ""} onChange={(name) => setDefinitionForm({ ...definitionForm, name })} />
          <TextAreaField label="Description" rows={embedded ? 2 : 3} compact={embedded} value={definitionForm.description ?? ""} onChange={(description) => setDefinitionForm({ ...definitionForm, description })} />
          <TextField label="Event type" required compact={embedded} value={definitionForm.eventType ?? ""} onChange={(eventType) => setDefinitionForm({ ...definitionForm, eventType })} />
          <TextAreaField label="Producers JSON" rows={embedded ? 5 : 7} compact={embedded} value={producersText} onChange={setProducersText} />
          <TextAreaField label="Payload example JSON" rows={embedded ? 5 : 7} compact={embedded} value={payloadExampleText} onChange={setPayloadExampleText} />
          <TextAreaField label="Body" rows={embedded ? 3 : 4} compact={embedded} value={definitionForm.body ?? ""} onChange={(body) => setDefinitionForm({ ...definitionForm, body })} />
        </FieldGroup>
      </form>
    </>
  );

  if (embedded) {
    if (renderEmbedded) return renderEmbedded({ actions, content });

    return (
      <div className="grid gap-3">
        {actions}
        {content}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {showCatalogWarnings && missingPolicyEventTypes.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Missing active event definitions for policy event types: {missingPolicyEventTypes.join(", ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:max-w-3xl">
        <Panel title={definitionForm.id ? "Update event definition" : "Create event definition"} icon={<Inbox data-icon="inline-start" />} action={actions}>
          {content}
        </Panel>
      </div>
    </div>
  );
}

const retryableRunStatuses = new Set(["failed", "blocked", "needs_input", "cancelled"]);

function AgentRunsView({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(data.agentRuns[0]?.runId);
  const [logs, setLogs] = useState<AgentRunLog[]>([]);
  const [error, setError] = useState("");
  const selectedRun = data.agentRuns.find((run) => run.runId === selectedRunId) ?? data.agentRuns[0];

  useEffect(() => {
    if (!selectedRun?.runId) {
      setLogs([]);
      return;
    }

    api.getAgentRunLogs(selectedRun.runId)
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load run logs."));
  }, [selectedRun?.runId]);

  useEffect(() => {
    if (!selectedRunId && data.agentRuns[0]?.runId) setSelectedRunId(data.agentRuns[0].runId);
  }, [data.agentRuns, selectedRunId]);

  const retry = async (run: AgentRun) => {
    setError("");
    try {
      await api.retryAgentRun(run.runId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry run.");
    }
  };

  const policyName = (run: AgentRun) => data.policies.find((policy) => policy.id === run.policyId)?.name ?? run.policyId;
  const agentName = (run: AgentRun) => data.agents.find((agent) => agent.id === run.agentRole)?.name ?? run.agentRole;

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(720px,1.25fr)_minmax(420px,0.75fr)]">
      <Panel
        title="Agent runs"
        description="Durable worker queue and completed outcomes."
        icon={<Activity data-icon="inline-start" />}
        action={(
          <Button type="button" size="icon-sm" variant="outline" aria-label="Refresh" title="Refresh" onClick={() => void refresh()}>
            <RefreshCw data-icon="inline-start" />
          </Button>
        )}
      >
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <DataTable
          empty="No agent runs queued."
          columns={["Created", "Agent", "Status", "Attempt", "Policy", "Thread", "Turn", "Error"]}
          rows={data.agentRuns.map((run) => ({
            id: run.runId,
            onClick: () => setSelectedRunId(run.runId),
            cells: [
              new Date(run.createdAt).toLocaleString(),
              agentName(run),
              <StatusBadge status={run.status} />,
              String(run.attempt),
              policyName(run),
              run.threadId ? <span className="font-mono text-xs">{run.threadId}</span> : "none",
              run.turnId ? <span className="font-mono text-xs">{run.turnId}</span> : "none",
              run.error ? <span className="text-destructive">{run.error}</span> : "none"
            ],
            action: retryableRunStatuses.has(run.status) ? (
              <Button
                size="icon-sm"
                variant="outline"
                title="Retry run"
                onClick={(event) => {
                  event.stopPropagation();
                  void retry(run);
                }}
              >
                <RefreshCw />
              </Button>
            ) : undefined
          }))}
        />
      </Panel>

      <Panel title="Run detail" icon={<CheckCircle2 data-icon="inline-start" />}>
        {selectedRun ? (
          <div className="grid gap-4">
            <div className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedRun.status} />
                <Badge variant="outline" className="rounded-md font-mono">{selectedRun.agentRole}</Badge>
              </div>
              <div className="font-mono text-xs text-muted-foreground break-all">{selectedRun.runId}</div>
            </div>
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Outcome</h3>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                {selectedRun.outcome ? readJson(selectedRun.outcome) : "No outcome yet."}
              </pre>
            </div>
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Logs</h3>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs recorded.</p>
              ) : (
                <div className="grid max-h-96 gap-2 overflow-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-md border p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={log.level === "error" ? "destructive" : "outline"} className="rounded-md">{log.level}</Badge>
                        <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm">{log.message}</p>
                      {log.data ? (
                        <pre className="mt-2 overflow-auto rounded bg-muted p-2 leading-relaxed">{readJson(log.data)}</pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="No run selected." />
        )}
      </Panel>
    </div>
  );
}

function CrudActions({
  newLabel,
  saveLabel,
  formId,
  id,
  disabled = false,
  leading,
  onNew,
  onDelete
}: {
  newLabel: string;
  saveLabel: string;
  formId: string;
  id?: string;
  disabled?: boolean;
  leading?: ReactNode;
  onNew: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      {leading}
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
        <Button type="button" size="icon-sm" variant="outline" aria-label={newLabel} title={newLabel} onClick={onNew}>
          <Plus data-icon="inline-start" />
        </Button>
        <Button type="submit" size="icon-sm" form={formId} disabled={disabled} aria-label={saveLabel} title={saveLabel}>
          <Save data-icon="inline-start" />
        </Button>
        {id ? (
          <Button type="button" size="icon-sm" variant="destructive" aria-label="Delete" title="Delete" onClick={onDelete}>
            <Trash2 data-icon="inline-start" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type ViewProps = {
  data: AppData;
  project?: Project;
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
};
