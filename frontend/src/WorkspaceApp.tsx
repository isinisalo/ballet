import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
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
  Hash,
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
  type LucideIcon
} from "lucide-react";
import type {
  Adr,
  Agent,
  AgentRun,
  AgentRunLog,
  AppData,
  Goal,
  MarkdownDocument,
  Project,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectDocumentTreeNode,
  ProjectPolicy,
  ProjectRuntime,
  ProjectWorkflow,
  Runtime,
  Skill
} from "../../backend/shared/domain";
import { agentTokenCandidates, generatedPolicyId, normalizePolicyToken, policyOutputEventTypes, preferredAgentToken } from "../../backend/shared/policy-actions";
import { seedData } from "../../backend/shared/seed";
import { api } from "./api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SelectField,
  StatusBadge,
  TextAreaField,
  TextField,
  statusVariant
} from "@/components/shared/workspace-ui";
import { cn } from "@/lib/utils";
import { useRuntimeStream } from "./app/useRuntimeStream";
import { applyThemeMode, getStoredThemeMode, persistThemeMode, type ThemeMode } from "./theme";

type View = "projects" | "project-document" | "project-goals" | "project-adrs" | "project-instructions" | "automation" | "agents" | "skills" | "agent-runs";
type SaveCollection = "projects" | "goals" | "adrs" | "agents" | "skills";
type AutomationTab = "policies" | "workflows" | "runtimes";
type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

interface RouteState {
  view: View;
  projectId?: string;
  documentPath?: string;
  automationTab?: AutomationTab;
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
  automation: {
    version: 1,
    events: [],
    policies: [],
    workflows: [],
    runtimes: []
  },
  automationIssues: [],
  projectDocumentTree: []
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

const automationConfigTemplate = (): ProjectAutomationConfig => ({
  version: 1,
  events: [],
  policies: [],
  workflows: [],
  runtimes: []
});

const slugValue = (value: string, fallback: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

const uniqueAutomationId = (base: string, ids: string[]) => {
  let candidate = slugValue(base, "item");
  let suffix = 2;
  while (ids.includes(candidate)) {
    candidate = `${slugValue(base, "item")}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const automationEventOptions = (config: ProjectAutomationConfig) => {
  const options = new Map<string, string>();
  for (const policy of config.policies) {
    for (const eventType of policyOutputEventTypes(policy)) {
      if (!options.has(eventType)) options.set(eventType, `${eventType} · output`);
    }
  }
  return [...options].map(([value, label]) => ({ value, label }));
};

const automationAgentOptions = (agents: Agent[]) => {
  const used = new Set<string>();
  return agents.map((agent) => {
    const token = agentTokenCandidates(agent).find((candidate) => !used.has(candidate)) ?? preferredAgentToken(agent);
    used.add(token);
    return { value: token, label: agent.name };
  });
};

const uniquePolicyAction = (event: string, agent: string, baseAction: string, policies: ProjectPolicy[]) => {
  const base = normalizePolicyToken(baseAction) || "action";
  let action = base;
  let suffix = 2;
  while (policies.some((policy) => policy.id === generatedPolicyId({ event, agent, action }))) {
    action = `${base}-${suffix}`;
    suffix += 1;
  }
  return action;
};

const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const goalsMatch = url.pathname.match(/^\/projects\/([^/]+)\/goals\/?$/);
  if (goalsMatch) return { view: "project-goals", projectId: decodeURIComponent(goalsMatch[1]) };

  const adrsMatch = url.pathname.match(/^\/projects\/([^/]+)\/adrs\/?$/);
  if (adrsMatch) return { view: "project-adrs", projectId: decodeURIComponent(adrsMatch[1]) };

  const instructionsMatch = url.pathname.match(/^\/projects\/([^/]+)\/instructions\/?$/);
  if (instructionsMatch) return { view: "project-instructions", projectId: decodeURIComponent(instructionsMatch[1]) };

  if (url.pathname === "/projects/document") {
    const documentPath = url.searchParams.get("path") ?? undefined;
    return documentPath ? { view: "project-document", documentPath } : { view: "projects" };
  }

  if (url.pathname === "/agents") return { view: "agents", documentPath: url.searchParams.get("path") ?? undefined };
  const automationMatch = url.pathname.match(/^\/automation\/(policies|workflows|runtimes)\/?$/);
  if (automationMatch) return { view: "automation", automationTab: automationMatch[1] as AutomationTab };
  if (url.pathname === "/automation") return { view: "automation", automationTab: "policies" };
  if (url.pathname === "/policies") return { view: "automation", automationTab: "policies" };
  if (url.pathname === "/workflow") return { view: "automation", automationTab: "workflows" };
  if (url.pathname === "/runtimes") return { view: "automation", automationTab: "runtimes" };
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/agent-runs") return { view: "agent-runs" };
  return { view: "projects" };
};

const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;

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

type MarkdownEntity = Pick<Project | Goal | Adr | MarkdownDocument | Skill, "id" | "frontmatter" | "body" | "relativePath" | "errors"> & {
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

const firstProjectTreeDocument = (node?: ProjectTreeDirectory): MarkdownDocument | undefined => {
  for (const child of node?.children ?? []) {
    if (child.type === "file") return child.document;
    const document = firstProjectTreeDocument(child);
    if (document) return document;
  }
  return undefined;
};

const projectDocumentCreateConfig: Record<ProjectDocumentCreateKind, { directoryPath: string; title: string; label: string }> = {
  adr: { directoryPath: ".ballet/adr", title: "New ADR", label: "New ADR" },
  goal: { directoryPath: ".ballet/goals", title: "New goal", label: "New goal" },
  instruction: { directoryPath: ".ballet/instructions", title: "New instruction", label: "New instruction" }
};

const createKindForProjectDocument = (relativePath?: string): ProjectDocumentCreateKind | undefined => {
  if (relativePath?.startsWith(".ballet/adr/")) return "adr";
  if (relativePath?.startsWith(".ballet/goals/")) return "goal";
  if (relativePath?.startsWith(".ballet/instructions/")) return "instruction";
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

type SidebarDocumentEntity = Pick<Agent | Skill, "id" | "name" | "relativePath">;
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
  emptyLabel,
  forceRender = false,
  viewPath,
  activeView = false
}: {
  label: string;
  icon: ReactNode;
  node?: ProjectTreeDirectory;
  activePath?: string;
  navigate: (path: string) => void;
  emptyLabel?: string;
  forceRender?: boolean;
  viewPath?: string;
  activeView?: boolean;
}) {
  const children = node?.children ?? [];
  const active = activeView || projectTreeContainsPath(children, activePath);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (!node && !forceRender) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={active}
            tooltip={label}
            onClick={(event) => {
              if (!viewPath) return;
              event.preventDefault();
              navigate(viewPath);
            }}
          >
            {icon}
            <span>{label}</span>
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

function AppSidebar({
  route,
  projectId,
  projectDocumentTree,
  agents,
  skills,
  navigate,
  themeMode,
  onThemeModeChange
}: {
  route: RouteState;
  projectId?: string;
  projectDocumentTree: ProjectDocumentTreeNode[];
  agents: Agent[];
  skills: Skill[];
  navigate: (path: string) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";
  const automationOpen = route.view === "automation";
  const activeProjectId = route.projectId ?? projectId ?? "project";
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
              <SidebarProjectDirectoryMenu
                label="ADR"
                icon={<Archive />}
                node={adrDirectory}
                activePath={route.documentPath}
                navigate={navigate}
                viewPath={`/projects/${encodeURIComponent(activeProjectId)}/adrs`}
                activeView={route.view === "project-adrs"}
              />
              <SidebarProjectDirectoryMenu
                label="Instructions"
                icon={<FileText />}
                node={instructionsDirectory}
                activePath={route.documentPath}
                navigate={navigate}
                forceRender
                emptyLabel="No instructions."
                viewPath={`/projects/${encodeURIComponent(activeProjectId)}/instructions`}
                activeView={route.view === "project-instructions"}
              />
              {item("Automation", <Route />, "/automation", automationOpen)}
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
              <SidebarProjectDirectoryMenu
                label="Goals"
                icon={<CheckCircle2 />}
                node={goalsDirectory}
                activePath={route.documentPath}
                navigate={navigate}
                viewPath={`/projects/${encodeURIComponent(activeProjectId)}/goals`}
                activeView={route.view === "project-goals"}
              />
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
  const [createDocumentKind, setCreateDocumentKind] = useState<ProjectDocumentCreateKind | null>(null);

  const project = data.projects.find((item) => item.id === (route.projectId ?? selectedProjectId)) ?? data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0];
  const goals = useMemo(() => data.goals.filter((goal) => goal.projectId === project?.id), [data.goals, project?.id]);
  const adrs = useMemo(() => data.adrs.filter((adr) => adr.projectId === project?.id), [data.adrs, project?.id]);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0];
  const selectedAdr = adrs.find((adr) => adr.id === selectedAdrId) ?? adrs[0];
  const projectDocumentTree = data.projectDocumentTree ?? [];
  const selectedProjectDocument = useMemo(
    () => findProjectTreeDocument(projectDocumentTree, route.documentPath),
    [projectDocumentTree, route.documentPath]
  );
  const selectedInstruction = useMemo(
    () => firstProjectTreeDocument(findProjectTreeDirectory(projectDocumentTree, ".ballet/instructions")),
    [projectDocumentTree]
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

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setRoute(routeFromPath(path));
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

  const createProjectDocument = async (kind: ProjectDocumentCreateKind, title: string) => {
    const config = projectDocumentCreateConfig[kind];
    const saved = await runMutation(
      () => api.createProjectDocument({
        directoryPath: config.directoryPath,
        title
      }),
      "Created.",
      `Unable to create ${kind}.`
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

  const saveAutomation = async (config: ProjectAutomationConfig) => {
    return runMutation(
      () => api.saveAutomation(config),
      "Saved.",
      "Unable to save automation config."
    );
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectId={project?.id}
          projectDocumentTree={projectDocumentTree}
          agents={data.agents}
          skills={data.skills}
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
              {route.view === "project-document" ? <ProjectDocumentPage document={selectedProjectDocument} saveProjectDocument={saveProjectDocument} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "project-goals" ? <GoalsPage project={project} selectedGoal={selectedGoal} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "project-adrs" ? <AdrsPage project={project} selectedAdr={selectedAdr} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "project-instructions" ? <InstructionsPage project={project} selectedInstruction={selectedInstruction} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "automation" ? <AutomationView data={data} activeTab={route.automationTab ?? "policies"} saveAutomation={saveAutomation} navigate={navigate} /> : null}
              {route.view === "agents" ? <AgentsView agent={selectedAgent} runtimes={data.runtimes} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "agent-runs" ? <AgentRunsView data={data} refresh={refresh} /> : null}
            </main>
          </ScrollArea>
          <CreateProjectDocumentDialog
            kind={createDocumentKind}
            onOpenChange={(open) => {
              if (!open) setCreateDocumentKind(null);
            }}
            onCreate={createProjectDocument}
          />
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
  saveProjectDocument,
  onCreateDocument
}: {
  document?: MarkdownDocument;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  onCreateDocument: (kind: ProjectDocumentCreateKind) => void;
}) {
  return (
    <ProjectMarkdownEditorView document={document} emptyTitle="No project document selected." saveProjectDocument={saveProjectDocument} onCreateDocument={onCreateDocument} />
  );
}

function ProjectMarkdownEditorView({
  document,
  emptyTitle,
  saveProjectDocument,
  onCreateDocument
}: {
  document?: MarkdownEntity;
  emptyTitle: string;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  onCreateDocument?: (kind: ProjectDocumentCreateKind) => void;
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
  const createKind = createKindForProjectDocument(document.relativePath);
  const createConfig = createKind ? projectDocumentCreateConfig[createKind] : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title="Edit Markdown"
        icon={<FileKey2 data-icon="inline-start" />}
        compact
        action={(
          <div className="flex items-center justify-end gap-2">
            {createKind && createConfig && onCreateDocument ? (
              <Button type="button" size="icon-sm" variant="outline" aria-label={createConfig.label} title={createConfig.label} onClick={() => onCreateDocument(createKind)}>
                <Plus data-icon="inline-start" />
              </Button>
            ) : null}
            <Button type="submit" size="icon-sm" form={formId} aria-label="Save Markdown" title="Save Markdown">
              <Save data-icon="inline-start" />
            </Button>
          </div>
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

function CollectionDocumentPanel({
  title,
  icon,
  document,
  emptyTitle,
  createKind,
  onCreateDocument
}: {
  title: string;
  icon: ReactNode;
  document?: MarkdownEntity;
  emptyTitle: string;
  createKind: ProjectDocumentCreateKind;
  onCreateDocument: (kind: ProjectDocumentCreateKind) => void;
}) {
  const createConfig = projectDocumentCreateConfig[createKind];

  return (
    <Panel
      title={title}
      icon={icon}
      compact
      action={(
        <Button type="button" size="icon-sm" variant="outline" aria-label={createConfig.label} title={createConfig.label} onClick={() => onCreateDocument(createKind)}>
          <Plus data-icon="inline-start" />
        </Button>
      )}
    >
      <MarkdownDocumentView document={document} emptyTitle={emptyTitle} compact embedded />
    </Panel>
  );
}

function GoalsPage({ project, selectedGoal, onCreateDocument }: { project?: Project; selectedGoal?: Goal; onCreateDocument: (kind: ProjectDocumentCreateKind) => void }) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading GOALS." />;

  return (
    <CollectionDocumentPanel
      title="Goals"
      icon={<CheckCircle2 data-icon="inline-start" />}
      document={selectedGoal}
      emptyTitle="No Goal document selected."
      createKind="goal"
      onCreateDocument={onCreateDocument}
    />
  );
}

function AdrsPage({ project, selectedAdr, onCreateDocument }: { project?: Project; selectedAdr?: Adr; onCreateDocument: (kind: ProjectDocumentCreateKind) => void }) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading ADRs." />;

  return (
    <CollectionDocumentPanel
      title="ADR"
      icon={<Archive data-icon="inline-start" />}
      document={selectedAdr}
      emptyTitle="No ADR document selected."
      createKind="adr"
      onCreateDocument={onCreateDocument}
    />
  );
}

function InstructionsPage({
  project,
  selectedInstruction,
  onCreateDocument
}: {
  project?: Project;
  selectedInstruction?: MarkdownDocument;
  onCreateDocument: (kind: ProjectDocumentCreateKind) => void;
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading instructions." />;

  return (
    <CollectionDocumentPanel
      title="Instructions"
      icon={<FileText data-icon="inline-start" />}
      document={selectedInstruction}
      emptyTitle="No instruction document selected."
      createKind="instruction"
      onCreateDocument={onCreateDocument}
    />
  );
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
      <AgentEditor
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

const automationTabs: Array<{ id: AutomationTab; label: string; icon: ReactNode }> = [
  { id: "policies", label: "Policies", icon: <Route data-icon="inline-start" /> },
  { id: "workflows", label: "Workflows", icon: <Activity data-icon="inline-start" /> },
  { id: "runtimes", label: "Runtimes", icon: <Code2 data-icon="inline-start" /> }
];

const noSelection = "__none__";

type AutomationConfigUpdater = (updater: (config: ProjectAutomationConfig) => ProjectAutomationConfig) => void;

function AutomationView({
  data,
  activeTab,
  saveAutomation,
  navigate
}: {
  data: AppData;
  activeTab: AutomationTab;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: (path: string) => void;
}) {
  const [draft, setDraft] = useState<ProjectAutomationConfig>(data.automation ?? automationConfigTemplate());
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedRuntimeId, setSelectedRuntimeId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = data.automation ?? automationConfigTemplate();
    setDraft(next);
    setSelectedPolicyId((current) => next.policies.some((policy) => policy.id === current) ? current : next.policies[0]?.id ?? "");
    setSelectedWorkflowId((current) => next.workflows.some((workflow) => workflow.id === current) ? current : next.workflows[0]?.id ?? "");
    setSelectedRuntimeId((current) => next.runtimes.some((runtime) => runtime.id === current) ? current : next.runtimes[0]?.id ?? "");
    setError("");
  }, [data.automation]);

  const updateConfig: AutomationConfigUpdater = (updater) => {
    setDraft((current) => updater(current));
  };

  const saveDraft = async () => {
    setError("");
    try {
      const saved = await saveAutomation(draft);
      setDraft(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save automation config.");
    }
  };

  const selectedPolicy = draft.policies.find((policy) => policy.id === selectedPolicyId) ?? draft.policies[0];
  const selectedWorkflow = draft.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? draft.workflows[0];
  const selectedRuntime = draft.runtimes.find((runtime) => runtime.id === selectedRuntimeId) ?? draft.runtimes[0];

  const addPolicy = () => {
    const event = automationEventOptions(draft)[0]?.value ?? "";
    const agent = data.agents[0] ? preferredAgentToken(data.agents[0]) : "";
    const action = uniquePolicyAction(event, agent, "implementation", draft.policies);
    const id = generatedPolicyId({ event, agent, action });
    setDraft((current) => ({
      ...current,
      policies: [...current.policies, {
        id,
        event,
        agent,
        action,
        enabled: true
      }]
    }));
    setSelectedPolicyId(id);
  };

  const addWorkflow = () => {
    const id = uniqueAutomationId("new-workflow", draft.workflows.map((workflow) => workflow.id));
    setDraft((current) => ({
      ...current,
      workflows: [...current.workflows, { id, title: "New workflow", steps: [] }]
    }));
    setSelectedWorkflowId(id);
  };

  const addRuntime = () => {
    const id = uniqueAutomationId("new-runtime", draft.runtimes.map((runtime) => runtime.id));
    setDraft((current) => ({
      ...current,
      runtimes: [...current.runtimes, { id, title: "New runtime", command: "codex", args: [] }]
    }));
    setSelectedRuntimeId(id);
  };

  const removeSelectedPolicy = () => {
    if (!selectedPolicy) return;
    setDraft((current) => ({
      ...current,
      policies: current.policies.filter((policy) => policy.id !== selectedPolicy.id),
      workflows: current.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.filter((step) => step !== selectedPolicy.id)
      }))
    }));
    setSelectedPolicyId(draft.policies.find((policy) => policy.id !== selectedPolicy.id)?.id ?? "");
  };

  const removeSelectedWorkflow = () => {
    if (!selectedWorkflow) return;
    setDraft((current) => ({
      ...current,
      workflows: current.workflows.filter((workflow) => workflow.id !== selectedWorkflow.id)
    }));
    setSelectedWorkflowId(draft.workflows.find((workflow) => workflow.id !== selectedWorkflow.id)?.id ?? "");
  };

  const removeSelectedRuntime = () => {
    if (!selectedRuntime) return;
    setDraft((current) => ({
      ...current,
      runtimes: current.runtimes.filter((runtime) => runtime.id !== selectedRuntime.id)
    }));
    setSelectedRuntimeId(draft.runtimes.find((runtime) => runtime.id !== selectedRuntime.id)?.id ?? "");
  };

  const addConfig = {
    policies: {
      label: "Add policy",
      onAdd: addPolicy
    },
    workflows: {
      label: "Add workflow",
      onAdd: addWorkflow
    },
    runtimes: {
      label: "Add runtime",
      onAdd: addRuntime
    }
  }[activeTab];

  const deleteConfig = {
    policies: {
      label: "Delete policy",
      type: "policy",
      resourceName: selectedPolicy?.id,
      canDelete: Boolean(selectedPolicy),
      onDelete: removeSelectedPolicy
    },
    workflows: {
      label: "Delete workflow",
      type: "workflow",
      resourceName: selectedWorkflow?.title || selectedWorkflow?.id,
      canDelete: Boolean(selectedWorkflow),
      onDelete: removeSelectedWorkflow
    },
    runtimes: {
      label: "Delete runtime",
      type: "runtime",
      resourceName: selectedRuntime?.title || selectedRuntime?.id,
      canDelete: Boolean(selectedRuntime),
      onDelete: removeSelectedRuntime
    }
  }[activeTab];

  return (
    <div className="grid gap-4">
      <Panel
        title="Automation"
        icon={<Route data-icon="inline-start" />}
        action={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="icon-sm" variant="outline" aria-label={addConfig.label} title={addConfig.label} onClick={addConfig.onAdd}>
              <Plus data-icon="inline-start" />
            </Button>
            <HeaderCrudActions
              saveAction={(
                <Button type="button" size="icon-sm" aria-label="Save automation" title="Save automation" onClick={() => void saveDraft()}>
                  <Save data-icon="inline-start" />
                </Button>
              )}
              deleteLabel={deleteConfig.label}
              deleteType={deleteConfig.type}
              resourceName={deleteConfig.resourceName}
              canDelete={deleteConfig.canDelete}
              onDelete={deleteConfig.onDelete}
            />
          </div>
        )}
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Automation sections">
            {automationTabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeTab === tab.id ? "default" : "outline"}
                size="sm"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => navigate(`/automation/${tab.id}`)}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </div>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <AutomationIssues issues={data.automationIssues} />
          {activeTab === "policies" ? (
            <PoliciesAutomationTab data={data} config={draft} selectedId={selectedPolicyId} onSelect={setSelectedPolicyId} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "workflows" ? (
            <WorkflowsAutomationTab config={draft} selectedId={selectedWorkflowId} onSelect={setSelectedWorkflowId} updateConfig={updateConfig} />
          ) : null}
          {activeTab === "runtimes" ? (
            <RuntimesAutomationTab config={draft} selectedId={selectedRuntimeId} onSelect={setSelectedRuntimeId} updateConfig={updateConfig} />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function AutomationIssues({ issues }: { issues: ProjectAutomationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ")}
      </AlertDescription>
    </Alert>
  );
}

function AutomationEntityList({
  empty,
  rows
}: {
  empty: string;
  rows: Array<{ id: string; label: string; active: boolean; onSelect: () => void }>;
}) {
  return (
    <div className="grid min-w-0 overflow-hidden rounded-lg border border-divider-strong bg-background p-3">
      <div className="flex flex-col gap-1">
        {rows.length === 0 ? <span className="px-2 py-1.5 text-xs text-muted-foreground">{empty}</span> : null}
        {rows.map((row) => (
          <Button
            key={row.id}
            type="button"
            variant={row.active ? "secondary" : "ghost"}
            className="h-auto w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal px-2 py-1.5 text-left font-mono text-xs"
            onClick={row.onSelect}
          >
            <span className="block w-0 min-w-0 flex-1 truncate text-left">{row.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function PoliciesAutomationTab({
  data,
  config,
  selectedId,
  onSelect,
  updateConfig
}: {
  data: AppData;
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const selected = config.policies.find((policy) => policy.id === selectedId) ?? config.policies[0];
  const eventOptions = [{ value: noSelection, label: "No event" }, ...automationEventOptions(config)];
  const agentOptions = [{ value: noSelection, label: "No agent" }, ...automationAgentOptions(data.agents)];

  const updateSelected = (patch: Partial<ProjectPolicy>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const normalized = {
      ...next,
      agent: normalizePolicyToken(next.agent),
      action: normalizePolicyToken(next.action)
    };
    const nextId = generatedPolicyId(normalized);
    updateConfig((current) => ({
      ...current,
      policies: current.policies.map((policy) => policy.id === selected.id ? { ...normalized, id: nextId } : policy),
      workflows: current.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.map((step) => step === selected.id ? nextId : step)
      }))
    }));
    onSelect(nextId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <AutomationEntityList
        empty="No policies."
        rows={config.policies.map((policy) => ({ id: policy.id, label: policy.id, active: policy.id === selected?.id, onSelect: () => onSelect(policy.id) }))}
      />
      {selected ? (
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel className="text-muted-foreground">Policy ID</FieldLabel>
            <div className="min-h-8 rounded border border-input bg-background px-2.5 py-1.5 font-mono text-xs text-muted-foreground break-all">
              {selected.id}
            </div>
          </Field>
          <SelectField label="Event" value={selected.event || noSelection} options={eventOptions} onChange={(event) => updateSelected({ event: event === noSelection ? "" : event })} />
          <SelectField label="Agent" value={selected.agent || noSelection} options={agentOptions} onChange={(agent) => updateSelected({ agent: agent === noSelection ? "" : agent })} />
          <TextField label="Action" required value={selected.action} onChange={(action) => updateSelected({ action })} />
        </FieldGroup>
      ) : <EmptyState title="No policy selected." />}
    </div>
  );
}

function WorkflowsAutomationTab({
  config,
  selectedId,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const selected = config.workflows.find((workflow) => workflow.id === selectedId) ?? config.workflows[0];
  const draggedStepIndexRef = useRef<number | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const policyById = useMemo(() => new Map(config.policies.map((policy) => [policy.id, policy])), [config.policies]);
  const policyOptions = [{ value: noSelection, label: "No policy" }, ...config.policies.map((policy) => ({ value: policy.id, label: policy.id }))];

  const updateSelected = (patch: Partial<ProjectWorkflow>) => {
    if (!selected) return;
    updateConfig((current) => ({
      ...current,
      workflows: current.workflows.map((workflow) => workflow.id === selected.id ? { ...workflow, ...patch } : workflow)
    }));
  };

  const updateStep = (index: number, policyId: string) => {
    if (!selected) return;
    updateSelected({ steps: selected.steps.map((step, stepIndex) => stepIndex === index ? policyId : step) });
  };

  const reorderStep = (fromIndex: number, toIndex: number) => {
    if (!selected) return;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= selected.steps.length || toIndex >= selected.steps.length) return;
    const steps = [...selected.steps];
    const [movedStep] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, movedStep);
    updateSelected({ steps });
  };

  const resetStepDrag = () => {
    draggedStepIndexRef.current = null;
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
  };

  const stepIndexFromPoint = (event: PointerEvent<HTMLDivElement>) => {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-workflow-step-index]");
    if (!(target instanceof HTMLElement)) return null;
    const targetIndex = Number(target.dataset.workflowStepIndex);
    return Number.isNaN(targetIndex) ? null : targetIndex;
  };

  const handleStepPointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    draggedStepIndexRef.current = index;
    setDraggedStepIndex(index);
    setDragOverStepIndex(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStepPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggedStepIndexRef.current === null) return;
    const targetIndex = stepIndexFromPoint(event);
    if (targetIndex !== null) setDragOverStepIndex(targetIndex);
  };

  const handleStepPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const fromIndex = draggedStepIndexRef.current;
    if (fromIndex === null) return;
    const toIndex = stepIndexFromPoint(event) ?? dragOverStepIndex ?? fromIndex;
    reorderStep(fromIndex, toIndex);
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
    draggedStepIndexRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <AutomationEntityList
        empty="No workflows."
        rows={config.workflows.map((workflow) => ({ id: workflow.id, label: workflow.id, active: workflow.id === selected?.id, onSelect: () => onSelect(workflow.id) }))}
      />
      {selected ? (
        <div className="grid gap-4">
          <div className="grid gap-3">
            <TextField label="Workflow ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          </div>
          <div className="grid gap-3">
            {selected.steps.map((policyId, index) => {
              const policy = policyById.get(policyId);
              const outputEvents = policy ? policyOutputEventTypes(policy) : [];
              return (
                <div
                  key={`${policyId}-${index}`}
                  data-workflow-step-index={index}
                  onPointerDown={(event) => handleStepPointerDown(event, index)}
                  onPointerMove={handleStepPointerMove}
                  onPointerUp={handleStepPointerUp}
                  onPointerCancel={resetStepDrag}
                  className={cn(
                    "cursor-grab select-none rounded-lg border border-divider-strong bg-background p-3 active:cursor-grabbing",
                    draggedStepIndex === index && "opacity-60",
                    dragOverStepIndex === index && draggedStepIndex !== index && "border-primary/70 ring-2 ring-primary/20"
                  )}
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_auto_minmax(10rem,0.65fr)_auto_minmax(18rem,1.35fr)_auto] md:items-center">
                    <WorkflowReadOnlyCard
                      label="Policy"
                      tone="policy"
                      value={(
                        <Select value={policyId || noSelection} onValueChange={(value) => updateStep(index, value === noSelection ? "" : value)}>
                          <SelectTrigger className="h-8 w-full min-w-0 px-2 text-xs" onDragStart={(event) => event.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {policyOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <WorkflowArrow />
                    <WorkflowReadOnlyCard label="Agent" value={policy?.agent ?? "Missing policy"} tone="agent" />
                    <WorkflowArrow />
                    <WorkflowReadOnlyCard
                      label="Events"
                      tone="event"
                      value={outputEvents.length > 0 ? (
                        <div className="flex min-w-0 flex-wrap gap-2">
                          {outputEvents.map((eventType) => (
                            <Badge key={eventType} variant="outline" className="max-w-full rounded-md font-mono text-[0.62rem] break-all">
                              {eventType}
                            </Badge>
                          ))}
                        </div>
                      ) : "Missing policy"}
                    />
                    <Button type="button" size="icon-sm" variant="destructive" aria-label="Remove workflow step" title="Remove workflow step" onClick={() => updateSelected({ steps: selected.steps.filter((_, stepIndex) => stepIndex !== index) })}>
                      <TrashButtonIcon />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="w-fit" onClick={() => updateSelected({ steps: [...selected.steps, config.policies[0]?.id ?? ""] })}>
              <Plus data-icon="inline-start" />
              Add policy step
            </Button>
          </div>
        </div>
      ) : <EmptyState title="No workflow selected." />}
    </div>
  );
}

function WorkflowArrow() {
  return <div className="hidden text-center font-mono text-xs text-muted-foreground md:block" aria-hidden="true">-&gt;</div>;
}

function WorkflowReadOnlyCard({ label, value, tone }: { label: string; value: ReactNode; tone: "policy" | "agent" | "event" }) {
  const Icon = tone === "policy" ? Route : tone === "agent" ? Bot : Activity;
  return (
    <div className="min-h-16 rounded-lg border border-divider-strong bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-mono text-[0.68rem] font-semibold uppercase text-muted-foreground">
          <Icon data-icon="inline-start" />
          {label}
        </span>
      </div>
      <div className="mt-2 min-w-0 text-sm text-foreground">
        {typeof value === "string" ? <span className="block truncate">{value}</span> : value}
      </div>
    </div>
  );
}

function RuntimesAutomationTab({
  config,
  selectedId,
  onSelect,
  updateConfig
}: {
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const selected = config.runtimes.find((runtime) => runtime.id === selectedId) ?? config.runtimes[0];

  const updateSelected = (patch: Partial<ProjectRuntime>) => {
    if (!selected) return;
    updateConfig((current) => ({
      ...current,
      runtimes: current.runtimes.map((runtime) => runtime.id === selected.id ? { ...runtime, ...patch } : runtime)
    }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <AutomationEntityList
        empty="No runtimes."
        rows={config.runtimes.map((runtime) => ({ id: runtime.id, label: runtime.id, active: runtime.id === selected?.id, onSelect: () => onSelect(runtime.id) }))}
      />
      {selected ? (
        <FieldGroup>
          <TextField label="Runtime ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextField label="Title" required value={selected.title} onChange={(title) => updateSelected({ title })} />
          <TextField label="Command" required value={selected.command} onChange={(command) => updateSelected({ command })} />
          <TextAreaField label="Args" rows={4} value={selected.args.join("\n")} onChange={(value) => updateSelected({ args: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
        </FieldGroup>
      ) : <EmptyState title="No runtime selected." />}
    </div>
  );
}

function TrashButtonIcon() {
  return <Trash2 data-icon="inline-start" />;
}

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
      deleteLabel="Delete agent"
      id={editor.form.id}
      disabled={editor.saveDisabled}
      deleteType="agent"
      resourceName={editor.form.name}
      onNew={editor.newAgent}
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

function AgentEditor(props: {
  agent?: Agent;
  runtimes: Runtime[];
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const editor = useAgentEditor(props);
  return <AgentEditorPanel editor={editor} />;
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

function CreateProjectDocumentDialog({
  kind,
  onOpenChange,
  onCreate
}: {
  kind: ProjectDocumentCreateKind | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (kind: ProjectDocumentCreateKind, title: string) => Promise<void>;
}) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const open = Boolean(kind);
  const config = kind ? projectDocumentCreateConfig[kind] : projectDocumentCreateConfig.instruction;

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
      if (!kind) return;
      await onCreate(kind, trimmedTitle);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to create ${config.title.toLowerCase()}.`);
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
              {config.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
              Create a Markdown document.
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
