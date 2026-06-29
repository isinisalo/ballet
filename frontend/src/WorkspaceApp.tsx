import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
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
  FileText,
  GitBranch,
  Hash,
  Inbox,
  Menu,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Route,
  Save,
  Sun,
  Tags,
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CrudActions,
  DataTable,
  EmptyState,
  ErrorPreview,
  HeaderCrudActions,
  Panel,
  SaveAction,
  SelectField,
  StatusBadge,
  SwitchField,
  TextAreaField,
  TextField,
  statusVariant
} from "@/components/shared/workspace-ui";
import { cn } from "@/lib/utils";
import { useRuntimeStream } from "./app/useRuntimeStream";
import { WorkflowConnector, WorkflowNode, type WorkflowNodeId } from "./features/workflow/workflow-node";
import { applyThemeMode, getStoredThemeMode, persistThemeMode, type ThemeMode } from "./theme";
import {
  applyWorkflowToPolicy,
  buildPolicyName,
  derivePolicyWorkflows,
  eventTypesForWorkflowPolicy,
  findOutputEventDefinition,
  mergeReadyProducer,
  targetAgentIdForWorkflowPolicy,
  type PolicyWorkflow,
  type WorkflowDraft
} from "./workflow-orchestrator";

type View = "projects" | "project-document" | "project-goals" | "project-adrs" | "workflow" | "agents" | "skills" | "runtimes" | "policies" | "events" | "agent-runs";
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
  if (value === "low") return "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15";
  if (value === "medium") return "border-tertiary/30 bg-tertiary/10 text-tertiary hover:bg-tertiary/15";
  if (value === "high") return "border-tertiary-container/40 bg-tertiary-container/20 text-tertiary hover:bg-tertiary-container/25";
  return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15";
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
  if (url.pathname === "/workflow") return { view: "workflow" };
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
              className="h-4 rounded-xl px-1.5 font-mono text-[0.6rem] uppercase"
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
      <Badge variant={statusVariant(String(value))} className="h-5 rounded-xl px-2 font-mono text-[0.65rem] uppercase">
        {String(value)}
      </Badge>
    );
  }
  return <span className="font-medium">{String(value)}</span>;
}

function FrontmatterPanel({ frontmatter }: { frontmatter?: Record<string, unknown> }) {
  const entries = Object.entries(frontmatter ?? {}).filter(([key]) => key !== "id");

  return (
    <aside className="rounded-lg border bg-card/95 px-3 py-2.5 ring-1 ring-foreground/5">
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

function SidebarInlineAction({
  label,
  children,
  onClick
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      className="ml-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-secondary/15 text-secondary opacity-95 hover:bg-secondary/25 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 group-data-[collapsible=icon]:hidden"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </span>
  );
}

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
              className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(path);
              }}
            >
              <span className="truncate">{document.name}</span>
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
              className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(path);
              }}
            >
              <AgentStatusDot status={agent.status} />
              <span className="truncate">{agent.name}</span>
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
  navigate,
  action,
  emptyLabel,
  forceRender = false
}: {
  label: string;
  icon: ReactNode;
  node?: ProjectTreeDirectory;
  activePath?: string;
  navigate: (path: string) => void;
  action?: ReactNode;
  emptyLabel?: string;
  forceRender?: boolean;
}) {
  const children = node?.children ?? [];
  const active = projectTreeContainsPath(children, activePath);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (!node && !forceRender) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={active} tooltip={label}>
            {icon}
            <span>{label}</span>
            {action}
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {children.length > 0 ? (
            <ProjectDocumentTree nodes={children} activePath={activePath} navigate={navigate} />
          ) : emptyLabel ? (
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {emptyLabel}
                </span>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          ) : null}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function AgentStatusDot({ status }: { status: Agent["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "online" ? "bg-secondary shadow-[0_0_0_3px] shadow-secondary/15" : "bg-muted-foreground/45"
      )}
    />
  );
}

const newWorkflowId = "__new_workflow__";
type WorkflowDraftState = WorkflowDraft & {
  policyId?: string;
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
  onThemeModeChange,
  onCreateInstruction,
  onNewAgent,
  onNewEventDefinition,
  onNewPolicy
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
  onCreateInstruction: (title: string) => Promise<void>;
  onNewAgent: () => void;
  onNewEventDefinition: () => void;
  onNewPolicy: () => void;
}) {
  const [createInstructionOpen, setCreateInstructionOpen] = useState(false);
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";
  const runtimesOpen = route.view === "runtimes";
  const policiesOpen = route.view === "policies";
  const eventsOpen = route.view === "events";
  const workflowOpen = route.view === "workflow";
  const adrDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/adr");
  const goalsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/goals");
  const instructionsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/instructions");
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
              <SidebarProjectDirectoryMenu
                label="Instructions"
                icon={<FileText />}
                node={instructionsDirectory}
                activePath={route.documentPath}
                navigate={navigate}
                forceRender
                emptyLabel="No instructions."
                action={(
                  <SidebarInlineAction label="New instruction" onClick={() => setCreateInstructionOpen(true)}>
                    <Plus data-icon="inline-start" />
                  </SidebarInlineAction>
                )}
              />
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
                      <SidebarInlineAction label="New agent" onClick={onNewAgent}>
                        <Plus data-icon="inline-start" />
                      </SidebarInlineAction>
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
                      <SidebarInlineAction label="New event definition" onClick={onNewEventDefinition}>
                        <Plus data-icon="inline-start" />
                      </SidebarInlineAction>
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
                      <SidebarInlineAction label="New policy" onClick={onNewPolicy}>
                        <Plus data-icon="inline-start" />
                      </SidebarInlineAction>
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
      <CreateInstructionDialog
        open={createInstructionOpen}
        onOpenChange={setCreateInstructionOpen}
        onCreate={onCreateInstruction}
      />
    </ShadcnSidebar>
  );
}

export function WorkspaceApp() {
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
    () => route.view === "agents" && !route.documentPath
      ? undefined
      : data.agents.find((agent) => agent.relativePath === route.documentPath) ?? data.agents[0],
    [data.agents, route.documentPath, route.view]
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
    () => route.view === "policies" && !route.documentPath
      ? undefined
      : data.policies.find((policy) => policy.relativePath === route.documentPath) ?? data.policies[0],
    [data.policies, route.documentPath, route.view]
  );
  const selectedEventDefinition = useMemo(
    () => route.view === "events" && !route.documentPath
      ? undefined
      : data.eventDefinitions.find((definition) => definition.relativePath === route.documentPath) ?? data.eventDefinitions[0],
    [data.eventDefinitions, route.documentPath, route.view]
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
    navigate("/workflow");
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

  const runtimeStreamStatus = useRuntimeStream(refresh);

  useEffect(() => {
    if (route.projectId) setSelectedProjectId(route.projectId);
  }, [route.projectId]);

  const runMutation = async <T,>(action: () => Promise<T>, successMessage: string, fallbackError: string) => {
    setError("");
    try {
      const result = await action();
      await refresh();
      setNotice(successMessage);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
      throw err;
    }
  };

  const save = async <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => {
    return runMutation(
      () => api.save(collection, item),
      "Saved.",
      `Unable to save ${collection}.`
    );
  };

  const saveProjectDocument = async (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => {
    return runMutation(
      () => api.saveProjectDocument(document),
      "Saved.",
      "Unable to save project document."
    );
  };

  const createInstruction = async (title: string) => {
    const saved = await runMutation(
      () => api.createProjectDocument({
        directoryPath: ".ballet/instructions",
        title
      }),
      "Created.",
      "Unable to create instruction."
    );
    navigate(projectDocumentPath(saved.relativePath));
  };

  const remove = async (collection: SaveCollection | "events", id: string) => {
    await runMutation(
      () => api.remove(collection, id),
      "Deleted.",
      `Unable to delete ${collection}.`
    );
  };

  const saveEventDefinition = async (eventDefinition: Partial<EventDefinition>) => {
    return runMutation(
      () => api.saveEventDefinition(eventDefinition),
      "Saved.",
      "Unable to save event definition."
    );
  };

  const removeEventDefinition = async (id: string) => {
    await runMutation(
      () => api.removeEventDefinition(id),
      "Deleted.",
      "Unable to delete event definition."
    );
  };

  const newAgent = () => navigate("/agents");
  const newEventDefinition = () => navigate("/events");
  const newPolicy = () => navigate("/policies");

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
          onCreateInstruction={createInstruction}
          onNewAgent={newAgent}
          onNewEventDefinition={newEventDefinition}
          onNewPolicy={newPolicy}
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
              {runtimeStreamStatus === "reconnecting" || runtimeStreamStatus === "disconnected" ? (
                <Alert variant={runtimeStreamStatus === "disconnected" ? "destructive" : "default"}>
                  <AlertDescription>
                    Runtime stream {runtimeStreamStatus}. Live updates will resume automatically.
                  </AlertDescription>
                </Alert>
              ) : null}

              {route.view === "projects" ? (
                <ProjectsOverview
                  project={project}
                  saveProjectDocument={saveProjectDocument}
                />
              ) : null}
              {route.view === "project-document" ? <ProjectDocumentPage document={selectedProjectDocument} saveProjectDocument={saveProjectDocument} /> : null}
              {route.view === "project-goals" ? <GoalsPage project={project} selectedGoal={selectedGoal} /> : null}
              {route.view === "project-adrs" ? <AdrsPage project={project} selectedAdr={selectedAdr} /> : null}
              {route.view === "workflow" ? (
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
              {route.view === "agents" ? <AgentsView agent={selectedAgent} runtimes={data.runtimes} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "runtimes" ? <RuntimesView runtime={selectedRuntime} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "policies" ? <PoliciesView data={data} project={project} policy={selectedPolicy} save={save} remove={remove} navigate={navigate} /> : null}
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
  save,
  remove,
  navigate
}: {
  agent?: Agent;
  runtimes: Runtime[];
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  navigate: (path: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <WorkflowAgentEditor
        variant="embedded"
        selected
        agent={agent}
        runtimes={runtimes}
        save={save}
        remove={remove}
        onSaved={(saved) => {
          if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath));
        }}
        onDeleted={() => navigate("/agents")}
      />
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
        action={(
          <CrudActions
            formId={formId}
            newLabel="New"
            saveLabel="Save skill"
            id={form.id}
            deleteType="skill"
            resourceName={form.name}
            onNew={() => setForm(skillTemplate())}
            onDelete={handleDelete}
          />
        )}
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
            deleteType="runtime"
            resourceName={form.name}
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

const workflowEventOptions = (definitions: EventDefinition[]) =>
  definitions.map((definition) => ({
    value: definition.eventType,
    label: `${definition.eventType} · ${definition.name}`
  }));

const policyDisplayName = (eventType: string, targetAgentId: string) =>
  eventType && targetAgentId ? buildPolicyName(eventType, targetAgentId) : "Policy name will be generated";

function useAgentEditor({
  agent,
  runtimes,
  save,
  remove,
  onSaved,
  onNew,
  onDeleted
}: {
  agent?: Agent;
  runtimes: Runtime[];
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
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

  return {
    form,
    formId,
    instructionsId,
    error,
    runtimeValue,
    runtimeOptions,
    modelValue,
    modelOptions,
    reasoningValue,
    reasoningOptions,
    saveDisabled: !form.name?.trim(),
    updateForm,
    updateRuntime,
    newAgent,
    submit,
    deleteAgent
  };
}

type AgentEditorState = ReturnType<typeof useAgentEditor>;

function AgentEditorActions({ editor }: { editor: AgentEditorState }) {
  return (
    <CrudActions
      formId={editor.formId}
      newLabel="New"
      saveLabel="Save agent"
      id={editor.form.id}
      disabled={editor.saveDisabled}
      deleteType="agent"
      resourceName={editor.form.name}
      onNew={editor.newAgent}
      onDelete={editor.deleteAgent}
    />
  );
}

function AgentEditorHeaderActions({ editor }: { editor: AgentEditorState }) {
  const saveAction = <SaveAction formId={editor.formId} label="Save agent" disabled={editor.saveDisabled} />;

  return (
    <HeaderCrudActions
      saveAction={saveAction}
      deleteLabel="Delete agent"
      deleteType="agent"
      resourceName={editor.form.name}
      canDelete={Boolean(editor.form.id)}
      onDelete={editor.deleteAgent}
    />
  );
}

function AgentEditorContent({ editor, showNameField = true }: { editor: AgentEditorState; showNameField?: boolean }) {
  return (
    <div className="grid gap-3">
      {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
      {editor.error ? <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
      <form id={editor.formId} className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
            <Select value={editor.runtimeValue} onValueChange={editor.updateRuntime} disabled={editor.runtimeOptions.length === 0}>
              <SelectTrigger size="sm" className="h-7 min-w-0 flex-[1_1_5.5rem] justify-between px-2">
                <SelectValue placeholder="No runtime" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {editor.runtimeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={editor.modelValue} onValueChange={(model) => editor.updateForm({ model })}>
              <SelectTrigger size="sm" className="h-7 min-w-0 flex-[1_1_4.75rem] justify-between px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {editor.modelOptions.map((option) => (
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
              className={cn("shrink-0", reasoningEffortTone(editor.reasoningValue))}
              aria-label={`Reasoning effort: ${editor.reasoningOptions.find((option) => option.value === editor.reasoningValue)?.label ?? editor.reasoningValue}`}
              title={`Reasoning effort: ${editor.reasoningOptions.find((option) => option.value === editor.reasoningValue)?.label ?? editor.reasoningValue}`}
              onClick={() => editor.updateForm({ modelReasoningEffort: nextReasoningEffort(editor.reasoningValue) })}
            >
              <ChartNoAxesColumnIncreasing data-icon="inline-start" />
            </Button>
        </div>
        <FieldGroup>
          {showNameField ? <TextField label="Name" required compact value={editor.form.name ?? ""} onChange={(name) => editor.updateForm({ name })} /> : null}
          <TextAreaField label="Description" rows={2} compact value={editor.form.description ?? ""} onChange={(description) => editor.updateForm({ description })} />
        </FieldGroup>
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={editor.instructionsId} className="text-muted-foreground">Instructions</FieldLabel>
            <Textarea
              id={editor.instructionsId}
              className="min-h-40 resize-y font-mono text-xs leading-relaxed"
              value={editor.form.instructions ?? ""}
              required
              onChange={(event) => editor.updateForm({ instructions: event.target.value })}
            />
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

function AgentEditorPanel({ editor }: { editor: AgentEditorState }) {
  return (
    <Panel
      title={editor.form.id ? "Update agent" : "Create agent"}
      icon={<Bot data-icon="inline-start" />}
      action={<AgentEditorActions editor={editor} />}
    >
      <AgentEditorContent editor={editor} />
    </Panel>
  );
}

function AgentEditorEmbeddedNode({
  editor,
  selected,
  onSelect,
  showNameField = true,
  summaryValue
}: {
  editor: AgentEditorState;
  selected: boolean;
  onSelect: () => void;
  showNameField?: boolean;
  summaryValue?: string;
}) {
  return (
    <WorkflowNode
      node="agent"
      selected={selected}
      value={summaryValue ?? editor.form.name ?? editor.form.id ?? ""}
      onSelect={onSelect}
      headerActions={showNameField ? <AgentEditorHeaderActions editor={editor} /> : undefined}
      footerActions={!showNameField && selected ? <AgentEditorActions editor={editor} /> : undefined}
      showSummaryLabel={false}
      showEditorValue={false}
      showEditorHeader={false}
      compactSummary
      inlineSummary
    >
      <AgentEditorContent editor={editor} showNameField={showNameField} />
    </WorkflowNode>
  );
}

function WorkflowAgentEditor({
  variant = "panel",
  selected = true,
  onSelect = () => undefined,
  showNameField = true,
  summaryValue,
  ...props
}: {
  variant?: "panel" | "embedded";
  selected?: boolean;
  onSelect?: () => void;
  summaryValue?: string;
  agent?: Agent;
  runtimes: Runtime[];
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
  showNameField?: boolean;
}) {
  const editor = useAgentEditor(props);
  if (variant === "embedded") {
    return <AgentEditorEmbeddedNode editor={editor} selected={selected} onSelect={onSelect} showNameField={showNameField} summaryValue={summaryValue} />;
  }

  return <AgentEditorPanel editor={editor} />;
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
  const [selectedNode, setSelectedNode] = useState<WorkflowNodeId | null>(null);
  const [error, setError] = useState("");
  const selectedNodeRef = useRef<WorkflowNodeId | null>(null);

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
      setError("");
      return;
    }
    if (selectedPolicyId === newWorkflowId) return;
    setDraft(buildDraft(selectedPolicy));
    setError("");
  }, [buildDraft, creatingWorkflow, selectedPolicy, selectedPolicyId]);

  const outputDefinition = definitionByEventType.get(draft.outputEventType);
  const targetAgent = agentById.get(draft.targetAgentId);
  const canSave = Boolean(draft.inputEventType && draft.targetAgentId && draft.outputEventType);
  const eventOptions = workflowEventOptions(activeDefinitions);
  const policyValue = policyDisplayName(draft.inputEventType, draft.targetAgentId);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!selectedNodeRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-workflow-node="true"], [data-radix-popper-content-wrapper], [role="listbox"]')) return;
      setSelectedNode(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const updateDraft = (patch: Partial<WorkflowDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
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
      name: buildPolicyName(draft.inputEventType, draft.targetAgentId),
      description: draft.policyDescription.trim() || fallbackDescription,
      active: draft.policyActive
    }, draft);
  }, [agentById, draft]);

  const embeddedPolicy = useMemo<Partial<Policy>>(() => {
    if (selectedPolicyId === newWorkflowId || !selectedPolicy) return buildWorkflowPolicyDraft();
    return applyWorkflowToPolicy({
      ...selectedPolicy,
      name: buildPolicyName(draft.inputEventType, draft.targetAgentId),
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
      policyDescription: policyDraft.description ?? "",
      policyActive: policyDraft.active ?? true,
      inputEventType: selectedEventType,
      targetAgentId: nextTargetAgentId,
      outputEventType: nextOutputEventType
    });
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
      if (!draft.inputEventType) throw new Error("Select a handled event type.");
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
        name: buildPolicyName(draft.inputEventType, draft.targetAgentId),
        description: isNewWorkflow ? draft.policyDescription.trim() || fallbackDescription : draft.policyDescription,
        active: draft.policyActive
      }, draft));

      await saveEventDefinition(mergeReadyProducer(output, draft.targetAgentId));
      setCreatingWorkflow(false);
      setSelectedPolicyId(savedPolicy.id);
      setDraft((current) => ({
        ...current,
        policyId: savedPolicy.id,
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
        <CardHeader className="min-h-12 items-center gap-1.5 bg-card px-4 py-2.5 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
          <CardTitle className="flex min-w-0 items-center gap-2 font-mono text-xs font-medium leading-none text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
            <Workflow data-icon="inline-start" />
            <span className="truncate">Workflows</span>
          </CardTitle>
          <CardAction className="col-start-2 row-span-1 row-start-1 justify-self-end self-center">
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
            <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-start">
              <PolicyEditor
                variant="embedded"
                data={data}
                policy={embeddedPolicy}
                save={save}
                remove={remove}
                newPolicyTemplate={buildWorkflowPolicyDraft}
                onSaved={handleEmbeddedPolicySaved}
                onDraftChange={handleEmbeddedPolicyDraftChange}
                selected={selectedNode === "policy"}
                onSelect={() => setSelectedNode("policy")}
                summaryValue={policyValue}
                actionPlacement="footer"
              />
              <WorkflowConnector />
              <WorkflowAgentEditor
                variant="embedded"
                selected={selectedNode === "agent"}
                onSelect={() => setSelectedNode("agent")}
                summaryValue={targetAgent?.name ?? draft.targetAgentId}
                agent={targetAgent}
                runtimes={data.runtimes}
                save={save}
                remove={remove}
                onSaved={handleAgentSaved}
                onNew={() => updateDraft({ targetAgentId: "" })}
                onDeleted={handleAgentDeleted}
                showNameField={false}
              />
              <WorkflowConnector />
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
                selected={selectedNode === "output"}
                onSelect={() => setSelectedNode("output")}
                summaryValue={draft.outputEventType}
                summaryOptions={eventOptions}
                onSummaryChange={selectOutputEvent}
                actionPlacement="footer"
                summarySelect
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
  navigate: (path: string) => void;
  newPolicyTemplate?: () => Partial<Policy>;
  onSaved?: (policy: Policy) => void;
  onDeleted?: (id: string) => void;
}) {
  const { data, policy, navigate, onSaved, onDeleted, ...editorProps } = props;

  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <PolicyEditor
        {...editorProps}
        data={data}
        policy={policy}
        variant="embedded"
        onNew={() => navigate("/policies")}
        onSaved={(saved) => {
          onSaved?.(saved);
          if (saved.relativePath) navigate(policyDocumentPath(saved.relativePath));
        }}
        onDeleted={(id) => {
          onDeleted?.(id);
          navigate("/policies");
        }}
      />
    </div>
  );
}

function usePolicyEditor({
  data,
  policy,
  save,
  remove,
  newPolicyTemplate,
  onNew,
  onSaved,
  onDeleted,
  onDraftChange
}: ViewProps & {
  project?: Project;
  policy?: Partial<Policy>;
  newPolicyTemplate?: () => Partial<Policy>;
  onNew?: () => void;
  onSaved?: (policy: Policy) => void;
  onDeleted?: (id: string) => void;
  onDraftChange?: (policy: Partial<Policy>, selectedEventType: string) => void;
}) {
  const formId = useId();
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
  const [error, setError] = useState("");
  const activeEventTypeSet = useMemo(() => new Set(activeDefinitions.map((definition) => definition.eventType)), [activeDefinitions]);
  const invalidSelectedEventType = selectedEventType && !activeEventTypeSet.has(selectedEventType) ? selectedEventType : "";
  const targetAgentId = policyTargetForForm(form, data.agents[0]?.id ?? "");
  const automaticPolicyName = buildPolicyName(selectedEventType, targetAgentId);

  useEffect(() => {
    const next = policy ?? createPolicyTemplate();
    const nextEventTypes = eventTypesForPolicy(next);
    setForm(next);
    setSelectedEventType(nextEventTypes[0] ?? activeDefinitions[0]?.eventType ?? "");
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
    setError("");
    onDraftChange?.(next, nextSelectedEventType);
    onNew?.();
  };

  const deletePolicy = async () => {
    if (!form.id) return;
    const deletedId = form.id;
    await remove("policies", deletedId);
    const next = createPolicyTemplate();
    const nextSelectedEventType = eventTypesForPolicy(next)[0] ?? activeDefinitions[0]?.eventType ?? "";
    setForm(next);
    setSelectedEventType(nextSelectedEventType);
    setError("");
    onDraftChange?.(next, nextSelectedEventType);
    onDeleted?.(deletedId);
  };

  const submit = async () => {
    setError("");
    try {
      if (!selectedEventType) throw new Error("Select exactly one event type for this policy.");
      if (!targetAgentId) throw new Error("Select an agent.");
      const advancedMatch = advancedPolicyMatchForForm(form);
      delete advancedMatch.eventTypes;
      const match = { ...advancedMatch, eventTypes: [selectedEventType] };
      const saved = await save("policies", {
        ...form,
        name: automaticPolicyName,
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

  const saveDisabled = data.agents.length === 0 || activeDefinitions.length === 0 || !selectedEventType || Boolean(invalidSelectedEventType);

  return {
    data,
    form,
    formId,
    selectedEventType,
    error,
    activeDefinitions,
    invalidSelectedEventType,
    targetAgentId,
    automaticPolicyName,
    saveDisabled,
    updateForm,
    updateSelectedEventType,
    newPolicy,
    deletePolicy,
    submit
  };
}

type PolicyEditorState = ReturnType<typeof usePolicyEditor>;

function PolicyEditorActions({ editor, showEnabledAction }: { editor: PolicyEditorState; showEnabledAction: boolean }) {
  return (
    <CrudActions
      formId={editor.formId}
      newLabel="New"
      saveLabel="Save policy"
      id={editor.form.id}
      disabled={editor.saveDisabled}
      deleteType="policy"
      resourceName={editor.automaticPolicyName}
      leading={showEnabledAction ? <SwitchField label="Enabled" checked={editor.form.active ?? true} onChange={(active) => editor.updateForm({ active })} /> : undefined}
      onNew={editor.newPolicy}
      onDelete={editor.deletePolicy}
    />
  );
}

function PolicyEditorHeaderActions({ editor }: { editor: PolicyEditorState }) {
  const saveAction = <SaveAction formId={editor.formId} label="Save policy" disabled={editor.saveDisabled} />;

  return (
    <HeaderCrudActions
      saveAction={saveAction}
      deleteLabel="Delete policy"
      deleteType="policy"
      resourceName={editor.automaticPolicyName}
      canDelete={Boolean(editor.form.id)}
      onDelete={editor.deletePolicy}
    />
  );
}

function PolicyEditorContent({ editor, embedded }: { editor: PolicyEditorState; embedded: boolean }) {
  return (
    <>
      {editor.form.errors?.length ? <ErrorPreview errors={editor.form.errors} /> : null}
      {editor.invalidSelectedEventType ? (
        <Alert variant="destructive">
          <AlertDescription>
            Policy references an event type that is not active in the event catalog: {editor.invalidSelectedEventType}
          </AlertDescription>
        </Alert>
      ) : null}
      {editor.error ? <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
      <form id={editor.formId} className={cn("flex flex-col gap-4", embedded && "gap-3")} onSubmit={(event) => { event.preventDefault(); void editor.submit(); }}>
        <FieldGroup>
          <TextAreaField label="Description" rows={embedded ? 2 : 3} compact={embedded} value={editor.form.description ?? ""} onChange={(description) => editor.updateForm({ description })} />
          {editor.activeDefinitions.length === 0 ? (
            <EmptyState title="No active event definitions." action="Create an active event before saving policies." />
          ) : (
            <SelectField
              label="Handled event type"
              value={editor.selectedEventType}
              options={[
                ...editor.activeDefinitions.map((definition) => ({ value: definition.eventType, label: `${definition.eventType} · ${definition.name}` })),
                ...(editor.invalidSelectedEventType ? [{ value: editor.invalidSelectedEventType, label: `${editor.invalidSelectedEventType} · unavailable` }] : [])
              ]}
              onChange={editor.updateSelectedEventType}
              compact={embedded}
            />
          )}
          <SelectField
            label="Target agent"
            value={editor.targetAgentId}
            options={editor.data.agents.map((agent) => ({ value: agent.id, label: agent.name }))}
            onChange={(targetAgentId) => editor.updateForm({ targetAgentId, action: { type: "start_agent_run", targetAgentId } })}
            compact={embedded}
          />
        </FieldGroup>
      </form>
    </>
  );
}

function PolicyEditorPanel({ editor, showEnabledAction }: { editor: PolicyEditorState; showEnabledAction: boolean }) {
  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <Panel title={editor.form.id ? "Update policy" : "Create policy"} icon={<GitBranch data-icon="inline-start" />} action={<PolicyEditorActions editor={editor} showEnabledAction={showEnabledAction} />}>
        <PolicyEditorContent editor={editor} embedded={false} />
      </Panel>
    </div>
  );
}

function PolicyEditorEmbeddedNode({
  editor,
  selected,
  onSelect,
  summaryValue,
  actionPlacement,
  showEnabledAction
}: {
  editor: PolicyEditorState;
  selected: boolean;
  onSelect: () => void;
  summaryValue?: string;
  actionPlacement: "header" | "footer";
  showEnabledAction: boolean;
}) {
  return (
    <WorkflowNode
      node="policy"
      selected={selected}
      value={summaryValue ?? policyDisplayName(editor.selectedEventType, editor.targetAgentId)}
      onSelect={onSelect}
      headerActions={actionPlacement === "header" ? <PolicyEditorHeaderActions editor={editor} /> : undefined}
      footerActions={actionPlacement === "footer" && selected ? <PolicyEditorActions editor={editor} showEnabledAction={showEnabledAction} /> : undefined}
      showSummaryLabel={false}
      showEditorValue={false}
      showEditorHeader={false}
      compactSummary
      inlineSummary
    >
      <PolicyEditorContent editor={editor} embedded />
    </WorkflowNode>
  );
}

function PolicyEditor({
  variant = "panel",
  selected = true,
  onSelect = () => undefined,
  summaryValue,
  actionPlacement = "header",
  showEnabledAction,
  ...props
}: ViewProps & {
  project?: Project;
  policy?: Partial<Policy>;
  newPolicyTemplate?: () => Partial<Policy>;
  onNew?: () => void;
  onSaved?: (policy: Policy) => void;
  onDeleted?: (id: string) => void;
  onDraftChange?: (policy: Partial<Policy>, selectedEventType: string) => void;
  variant?: "panel" | "embedded";
  selected?: boolean;
  onSelect?: () => void;
  summaryValue?: string;
  actionPlacement?: "header" | "footer";
  showEnabledAction?: boolean;
}) {
  const editor = usePolicyEditor(props);
  const enabledActionVisible = showEnabledAction ?? variant !== "embedded";

  if (variant === "embedded") {
    return (
      <PolicyEditorEmbeddedNode
        editor={editor}
        selected={selected}
        onSelect={onSelect}
        summaryValue={summaryValue}
        actionPlacement={actionPlacement}
        showEnabledAction={enabledActionVisible}
      />
    );
  }

  return <PolicyEditorPanel editor={editor} showEnabledAction={enabledActionVisible} />;
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
}) {
  const { data, eventDefinition, navigate, onSaved, onDeleted, ...editorProps } = props;

  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <EventDefinitionEditor
        {...editorProps}
        data={data}
        eventDefinition={eventDefinition}
        navigate={navigate}
        variant="embedded"
        onSaved={(saved) => {
          onSaved?.(saved);
          if (saved.relativePath) navigate?.(eventDefinitionDocumentPath(saved.relativePath));
        }}
        onDeleted={(id) => {
          onDeleted?.(id);
          navigate?.("/events");
        }}
      />
    </div>
  );
}

function useEventDefinitionEditor({
  data,
  eventDefinition,
  saveEventDefinition,
  removeEventDefinition,
  navigate,
  onSaved,
  onNew,
  onDeleted
}: {
  data: AppData;
  eventDefinition?: EventDefinition;
  saveEventDefinition: (eventDefinition: Partial<EventDefinition>) => Promise<EventDefinition>;
  removeEventDefinition: (id: string) => Promise<void>;
  navigate?: (path: string) => void;
  onSaved?: (eventDefinition: EventDefinition) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const formId = useId();
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

  const deleteDefinition = async () => {
    if (!definitionForm.id) return;
    await removeEventDefinition(definitionForm.id);
    onDeleted?.(definitionForm.id);
    if (!onDeleted) navigate?.("/events");
  };

  return {
    data,
    formId,
    definitionForm,
    setDefinitionForm,
    producersText,
    setProducersText,
    payloadExampleText,
    setPayloadExampleText,
    definitionError,
    missingPolicyEventTypes,
    saveDefinition,
    newDefinition,
    deleteDefinition
  };
}

type EventDefinitionEditorState = ReturnType<typeof useEventDefinitionEditor>;

function EventDefinitionEditorActions({ editor, showEnabledAction }: { editor: EventDefinitionEditorState; showEnabledAction: boolean }) {
  return (
    <CrudActions
      formId={editor.formId}
      newLabel="New"
      saveLabel="Save definition"
      id={editor.definitionForm.id}
      deleteType="event definition"
      resourceName={editor.definitionForm.name || editor.definitionForm.eventType}
      leading={showEnabledAction ? <SwitchField label="Enabled" checked={editor.definitionForm.active ?? true} onChange={(active) => editor.setDefinitionForm({ ...editor.definitionForm, active })} /> : undefined}
      onNew={editor.newDefinition}
      onDelete={editor.deleteDefinition}
    />
  );
}

function EventDefinitionEditorHeaderActions({ editor }: { editor: EventDefinitionEditorState }) {
  const saveAction = <SaveAction formId={editor.formId} label="Save definition" />;

  return (
    <HeaderCrudActions
      saveAction={saveAction}
      deleteLabel="Delete event definition"
      deleteType="event definition"
      resourceName={editor.definitionForm.name || editor.definitionForm.eventType}
      canDelete={Boolean(editor.definitionForm.id)}
      onDelete={editor.deleteDefinition}
    />
  );
}

function EventDefinitionEditorContent({
  editor,
  embedded,
  showCatalogWarnings
}: {
  editor: EventDefinitionEditorState;
  embedded: boolean;
  showCatalogWarnings: boolean;
}) {
  return (
    <>
      {showCatalogWarnings && editor.missingPolicyEventTypes.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Missing active event definitions for policy event types: {editor.missingPolicyEventTypes.join(", ")}
          </AlertDescription>
        </Alert>
      ) : null}
      {editor.definitionForm.errors?.length ? <ErrorPreview errors={editor.definitionForm.errors} /> : null}
      {editor.definitionError ? <Alert variant="destructive"><AlertDescription>{editor.definitionError}</AlertDescription></Alert> : null}
      <form id={editor.formId} className={cn("flex flex-col gap-4", embedded ? "gap-3" : "mt-4")} onSubmit={(event) => { event.preventDefault(); void editor.saveDefinition(); }}>
        <FieldGroup>
          <TextField label="Name" required compact={embedded} value={editor.definitionForm.name ?? ""} onChange={(name) => editor.setDefinitionForm({ ...editor.definitionForm, name })} />
          <TextAreaField label="Description" rows={embedded ? 2 : 3} compact={embedded} value={editor.definitionForm.description ?? ""} onChange={(description) => editor.setDefinitionForm({ ...editor.definitionForm, description })} />
          <TextField label="Event type" required compact={embedded} value={editor.definitionForm.eventType ?? ""} onChange={(eventType) => editor.setDefinitionForm({ ...editor.definitionForm, eventType })} />
          <TextAreaField label="Producers JSON" rows={embedded ? 5 : 7} compact={embedded} value={editor.producersText} onChange={editor.setProducersText} />
          <TextAreaField label="Payload example JSON" rows={embedded ? 5 : 7} compact={embedded} value={editor.payloadExampleText} onChange={editor.setPayloadExampleText} />
          <TextAreaField label="Body" rows={embedded ? 3 : 4} compact={embedded} value={editor.definitionForm.body ?? ""} onChange={(body) => editor.setDefinitionForm({ ...editor.definitionForm, body })} />
        </FieldGroup>
      </form>
    </>
  );
}

function EventDefinitionEditorPanel({
  editor,
  showCatalogWarnings,
  showEnabledAction
}: {
  editor: EventDefinitionEditorState;
  showCatalogWarnings: boolean;
  showEnabledAction: boolean;
}) {
  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <Panel
        title={editor.definitionForm.id ? "Update event definition" : "Create event definition"}
        icon={<Inbox data-icon="inline-start" />}
        action={<EventDefinitionEditorActions editor={editor} showEnabledAction={showEnabledAction} />}
      >
        <EventDefinitionEditorContent editor={editor} embedded={false} showCatalogWarnings={showCatalogWarnings} />
      </Panel>
    </div>
  );
}

function EventDefinitionEditorEmbeddedNode({
  editor,
  selected,
  onSelect,
  summaryValue,
  summaryOptions,
  onSummaryChange,
  actionPlacement,
  showCatalogWarnings,
  showEnabledAction,
  summarySelect
}: {
  editor: EventDefinitionEditorState;
  selected: boolean;
  onSelect: () => void;
  summaryValue?: string;
  summaryOptions?: Array<{ value: string; label: string }>;
  onSummaryChange?: (value: string) => void;
  actionPlacement: "header" | "footer";
  showCatalogWarnings: boolean;
  showEnabledAction: boolean;
  summarySelect: boolean;
}) {
  return (
    <WorkflowNode
      node="output"
      selected={selected}
      value={summaryValue ?? editor.definitionForm.eventType ?? ""}
      options={summaryOptions}
      onChange={onSummaryChange}
      onSelect={onSelect}
      headerActions={actionPlacement === "header" ? <EventDefinitionEditorHeaderActions editor={editor} /> : undefined}
      footerActions={actionPlacement === "footer" && selected ? <EventDefinitionEditorActions editor={editor} showEnabledAction={showEnabledAction} /> : undefined}
      showSummaryLabel={false}
      showEditorHeader={false}
      compactSummary
      inlineSummary
      summarySelect={summarySelect}
    >
      <EventDefinitionEditorContent editor={editor} embedded showCatalogWarnings={showCatalogWarnings} />
    </WorkflowNode>
  );
}

function EventDefinitionEditor({
  variant = "panel",
  selected = true,
  onSelect = () => undefined,
  summaryValue,
  summaryOptions,
  onSummaryChange,
  actionPlacement = "header",
  showCatalogWarnings = true,
  showEnabledAction,
  summarySelect = false,
  ...props
}: {
  data: AppData;
  eventDefinition?: EventDefinition;
  saveEventDefinition: (eventDefinition: Partial<EventDefinition>) => Promise<EventDefinition>;
  removeEventDefinition: (id: string) => Promise<void>;
  navigate?: (path: string) => void;
  onSaved?: (eventDefinition: EventDefinition) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
  variant?: "panel" | "embedded";
  selected?: boolean;
  onSelect?: () => void;
  summaryValue?: string;
  summaryOptions?: Array<{ value: string; label: string }>;
  onSummaryChange?: (value: string) => void;
  actionPlacement?: "header" | "footer";
  showCatalogWarnings?: boolean;
  showEnabledAction?: boolean;
  summarySelect?: boolean;
}) {
  const editor = useEventDefinitionEditor(props);
  const enabledActionVisible = showEnabledAction ?? variant !== "embedded";

  if (variant === "embedded") {
    return (
      <EventDefinitionEditorEmbeddedNode
        editor={editor}
        selected={selected}
        onSelect={onSelect}
        summaryValue={summaryValue}
        summaryOptions={summaryOptions}
        onSummaryChange={onSummaryChange}
        actionPlacement={actionPlacement}
        showCatalogWarnings={showCatalogWarnings}
        showEnabledAction={enabledActionVisible}
        summarySelect={summarySelect}
      />
    );
  }

  return <EventDefinitionEditorPanel editor={editor} showCatalogWarnings={showCatalogWarnings} showEnabledAction={enabledActionVisible} />;
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
                <Badge variant="outline" className="rounded-xl font-mono">{selectedRun.agentRole}</Badge>
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

function CreateInstructionDialog({
  open,
  onOpenChange,
  onCreate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) return;
    setTitle("");
    setError("");
    setPending(false);
  }, [open]);

  const submit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    setPending(true);
    setError("");
    try {
      await onCreate(trimmedTitle);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create instruction.");
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-divider-strong bg-card p-4 text-card-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-1.5">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              New instruction
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
              Create a Markdown instruction document.
            </DialogPrimitive.Description>
          </div>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <form id={formId} className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <FieldGroup>
              <TextField label="Title" required value={title} onChange={setTitle} />
            </FieldGroup>
          </form>
          <div className="flex items-center justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="outline" className="cursor-pointer" disabled={pending}>
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button type="submit" form={formId} className="cursor-pointer" disabled={pending || !title.trim()}>
              <Plus data-icon="inline-start" />
              Create
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type ViewProps = {
  data: AppData;
  project?: Project;
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
};
