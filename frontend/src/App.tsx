import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMap, parseDocument, stringify as stringifyYaml } from "yaml";
import {
  Archive,
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
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
  type LucideIcon
} from "lucide-react";
import type { Adr, Agent, AgentRun, AgentRunLog, AppData, EventRecord, Goal, MarkdownDocument, Policy, Project, ProjectDocumentTreeNode, Runtime, Skill } from "../../backend/shared/domain";
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

type View = "projects" | "project-document" | "project-goals" | "project-adrs" | "agents" | "skills" | "runtimes" | "policies" | "events" | "agent-runs";
type SaveCollection = "projects" | "goals" | "adrs" | "agents" | "skills" | "runtimes" | "policies" | "events";

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
  events: [],
  agentRuns: [],
  projectDocumentTree: []
};

const toCsv = (values: string[]) => values.join(", ");
const fromCsv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
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

const parsePayload = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
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

const eventTemplate = (projectId: string): Partial<EventRecord> & Pick<EventRecord, "projectId" | "eventType"> => ({
  projectId,
  source: "runtime-codex",
  eventType: "plan.approved.v1",
  tags: ["delivery"],
  payload: {
    work_item_id: "work-1",
    plan_id: "plan-1",
    summary: "Approved change plan."
  }
});

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
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/runtimes") return { view: "runtimes" };
  if (url.pathname === "/policies") return { view: "policies", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/events") return { view: "events" };
  if (url.pathname === "/agent-runs") return { view: "agent-runs" };
  return { view: "projects" };
};

const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
const policyDocumentPath = (relativePath: string) => `/policies?path=${encodeURIComponent(relativePath)}`;

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

type SidebarDocumentEntity = Pick<Agent | Skill | Policy, "id" | "name" | "relativePath">;
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
  placeholder
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  required = false,
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  className?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea className={className} value={value} rows={rows} required={required} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
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
    <Field orientation="horizontal" className="items-center justify-between rounded-lg border p-3">
      <FieldLabel>{label}</FieldLabel>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Field>
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
      <CardHeader className={cn(compact && "gap-1.5 px-4 py-3")}>
        <CardTitle className={cn("flex items-center gap-2", compact && "text-base")}>
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription className={cn(compact && "text-xs")}>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn(compact && "px-4 pb-4")}>{children}</CardContent>
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

function AppSidebar({
  route,
  projectDocumentTree,
  agents,
  skills,
  policies,
  navigate,
  themeMode,
  onThemeModeChange
}: {
  route: RouteState;
  projectDocumentTree: ProjectDocumentTreeNode[];
  agents: Agent[];
  skills: Skill[];
  policies: Policy[];
  navigate: (path: string) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const projectsOpen = route.view === "projects" || route.view === "project-document" || route.view === "project-goals" || route.view === "project-adrs";
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";
  const policiesOpen = route.view === "policies";
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
              <Collapsible defaultOpen={projectsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={projectsOpen} tooltip="Project">
                      <Layers3 />
                      <span>Project</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ProjectDocumentTree nodes={projectDocumentTree} activePath={route.documentPath} navigate={navigate} />
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
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
              {item("Runtimes", <Code2 />, "/runtimes", route.view === "runtimes")}
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
              {item("Events", <Inbox />, "/events", route.view === "events")}
              {item("Agent runs", <Activity />, "/agent-runs", route.view === "agent-runs")}
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
  const selectedPolicy = useMemo(
    () => data.policies.find((policy) => policy.relativePath === route.documentPath) ?? data.policies[0],
    [data.policies, route.documentPath]
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

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectDocumentTree={projectDocumentTree}
          agents={data.agents}
          skills={data.skills}
          policies={data.policies}
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
              {route.view === "agents" ? <AgentsView agent={selectedAgent} runtimes={data.runtimes} save={save} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "runtimes" ? <RuntimesView data={data} save={save} remove={remove} /> : null}
              {route.view === "policies" ? <PoliciesView data={data} project={project} policy={selectedPolicy} save={save} remove={remove} /> : null}
              {route.view === "events" ? <EventsView data={data} project={project} refresh={refresh} remove={remove} /> : null}
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
      <Panel title="Edit Markdown" icon={<FileKey2 data-icon="inline-start" />} compact>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          {validationError ? <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert> : null}
          <FieldGroup>
            <TextAreaField label="Frontmatter" rows={10} value={frontmatterText} onChange={setFrontmatterText} className="font-mono text-xs leading-relaxed" />
            <TextAreaField label="Markdown" rows={18} value={bodyText} onChange={setBodyText} className="font-mono text-xs leading-relaxed" />
          </FieldGroup>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit">
              <Save data-icon="inline-start" />
              Save Markdown
            </Button>
          </div>
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
          <div className="flex size-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
            <section className="border-t px-5 py-4">
              <h2 className="mb-3 font-mono text-xs font-medium uppercase text-muted-foreground">Errors</h2>
              <ErrorPreview errors={agent.errors} />
            </section>
          ) : null}
          <section className="border-t px-5 py-4">
            <h2 className="mb-4 font-mono text-xs font-medium uppercase text-muted-foreground">Properties</h2>
            <dl className="flex flex-col gap-3">
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
          <section className="border-t px-5 py-4">
            <h2 className="mb-4 flex items-center gap-2 font-mono text-xs font-medium uppercase text-muted-foreground">
              Skills
              <span className="font-sans text-[0.7rem] font-normal">{agent.skills.length}</span>
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
        <CardHeader className="border-b px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileKey2 className="size-3.5" aria-hidden="true" />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); void saveInstructions(); }}>
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
            <div className="flex justify-end">
              <Button type="submit" disabled={savingInstructions || instructionsText === agent.instructions}>
                <Save data-icon="inline-start" />
                {savingInstructions ? "Saving..." : "Save instructions"}
              </Button>
            </div>
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-xs font-medium uppercase text-muted-foreground">Preview</h2>
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
      <Panel title={form.id ? "Update skill" : "Create skill"} icon={<FileKey2 data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextAreaField label="Description" required value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <TextAreaField label="Markdown" rows={14} value={form.body ?? ""} onChange={(body) => setForm({ ...form, body })} />
          </FieldGroup>
          <CrudActions newLabel="New" saveLabel="Save skill" id={form.id} onNew={() => setForm(skillTemplate())} onDelete={handleDelete} />
        </form>
      </Panel>
      <Panel title="Preview" icon={<Eye data-icon="inline-start" />} compact>
        <MarkdownDocumentView document={skill} emptyTitle="No skill selected." embedded />
      </Panel>
    </div>
  );
}

function RuntimesView({ data, save, remove }: ViewProps) {
  const [form, setForm] = useState<Partial<Runtime>>(runtimeTemplate());
  const [configText, setConfigText] = useState(toKeyValueLines(runtimeTemplate().config ?? {}));

  const editRuntime = (runtime: Runtime) => {
    setForm(runtime);
    setConfigText(toKeyValueLines(runtime.config));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1fr)_minmax(420px,1fr)]">
      <Panel title="Runtimes" icon={<Code2 data-icon="inline-start" />}>
        <DataTable
          empty="No runtimes configured."
          columns={["Name", "Type", "Command", "Enabled"]}
          rows={data.runtimes.map((runtime) => ({
            id: runtime.id,
            cells: [runtime.name, runtime.type, runtime.command, runtime.enabled ? "enabled" : "disabled"],
            onClick: () => editRuntime(runtime)
          }))}
        />
      </Panel>
      <Panel title={form.id ? "Update runtime" : "Create runtime"} icon={<Code2 data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void save("runtimes", { ...form, config: fromKeyValueLines(configText) }); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <SelectField
              label="Type"
              value={form.type ?? "codex-cli"}
              options={[{ value: "codex-cli", label: "Codex CLI" }, { value: "custom", label: "Custom" }]}
              onChange={(type) => setForm({ ...form, type: type as Runtime["type"] })}
            />
            <TextField label="Command" required value={form.command ?? ""} onChange={(command) => setForm({ ...form, command })} />
            <SwitchField label="Enabled" checked={form.enabled ?? true} onChange={(enabled) => setForm({ ...form, enabled })} />
            <TextAreaField label="Config (key=value)" rows={6} value={configText} onChange={setConfigText} />
          </FieldGroup>
          <CrudActions
            newLabel="New Codex CLI runtime"
            saveLabel="Save runtime"
            id={form.id}
            onNew={() => { setForm(runtimeTemplate()); setConfigText(toKeyValueLines(runtimeTemplate().config ?? {})); }}
            onDelete={() => void remove("runtimes", form.id!)}
          />
        </form>
      </Panel>
    </div>
  );
}

function PoliciesView({ data, policy, save, remove }: ViewProps & { project?: Project; policy?: Policy }) {
  const [form, setForm] = useState<Partial<Policy>>(policy ?? policyTemplate(data.agents[0]?.id ?? ""));
  const [matchText, setMatchText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = policy ?? policyTemplate(data.agents[0]?.id ?? "");
    setForm(next);
    setMatchText(readJson(policyMatchForForm(next)));
    setError("");
  }, [data.agents, policy]);

  const submit = async () => {
    setError("");
    try {
      const match = parsePolicyMatch(matchText);
      const targetAgentId = policyTargetForForm(form, data.agents[0]?.id ?? "");
      await save("policies", {
        ...form,
        match,
        action: { type: "start_agent_run", targetAgentId },
        targetAgentId,
        projectId: typeof match.projectId === "string" ? match.projectId : "*",
        source: typeof match.source === "string" ? match.source : "*",
        eventTypes: match.eventTypes ?? [],
        payloadMetadata: {}
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save policy.");
    }
  };

  return (
    <div className="grid gap-4 xl:max-w-3xl">
      <Panel title={form.id ? "Update policy" : "Create policy"} icon={<GitBranch data-icon="inline-start" />}>
        {form.errors?.length ? <ErrorPreview errors={form.errors} /> : null}
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextAreaField label="Description" value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <SelectField
              label="Target agent"
              value={policyTargetForForm(form, data.agents[0]?.id ?? "")}
              options={data.agents.map((agent) => ({ value: agent.id, label: agent.name }))}
              onChange={(targetAgentId) => setForm({ ...form, targetAgentId, action: { type: "start_agent_run", targetAgentId } })}
            />
            <SwitchField label="Active" checked={form.active ?? true} onChange={(active) => setForm({ ...form, active })} />
            <TextAreaField label="Match JSON" rows={10} value={matchText} onChange={setMatchText} />
          </FieldGroup>
          <CrudActions
            newLabel="New"
            saveLabel="Save policy"
            id={form.id}
            disabled={data.agents.length === 0}
            onNew={() => {
              const next = policyTemplate(data.agents[0]?.id ?? "");
              setForm(next);
              setMatchText(readJson(policyMatchForForm(next)));
              setError("");
            }}
            onDelete={() => void remove("policies", form.id!)}
          />
        </form>
      </Panel>
    </div>
  );
}

function EventsView({ data, project, refresh, remove }: { data: AppData; project?: Project; refresh: () => Promise<void>; remove: (collection: SaveCollection, id: string) => Promise<void> }) {
  const [form, setForm] = useState(eventTemplate(project?.id ?? ""));
  const [payloadText, setPayloadText] = useState(readJson(form.payload));
  const [error, setError] = useState("");

  useEffect(() => {
    const next = eventTemplate(project?.id ?? "");
    setForm(next);
    setPayloadText(readJson(next.payload));
  }, [project?.id]);

  const submit = async () => {
    setError("");
    try {
      await api.intakeEvent({
        ...form,
        payload: parsePayload(payloadText),
        tags: form.tags ?? [],
        body: form.body ?? "Event submitted from the dashboard."
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit event.");
    }
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(420px,0.8fr)_minmax(620px,1.2fr)]">
      <Panel title="Event intake" icon={<Inbox data-icon="inline-start" />}>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <FieldGroup>
            <SelectField
              label="Project"
              value={form.projectId}
              options={data.projects.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(projectId) => setForm({ ...form, projectId })}
            />
            <TextField label="Event type" required value={form.eventType} onChange={(eventType) => setForm({ ...form, eventType })} />
            <TextField label="Source agent/runtime" value={form.source ?? ""} onChange={(source) => setForm({ ...form, source })} />
            <TextField label="Tags" value={toCsv(form.tags ?? [])} onChange={(value) => setForm({ ...form, tags: fromCsv(value) })} />
            <TextAreaField label="Payload JSON" rows={9} value={payloadText} onChange={setPayloadText} />
          </FieldGroup>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { const next = eventTemplate(project?.id ?? ""); setForm(next); setPayloadText(readJson(next.payload)); }}>
              <Plus data-icon="inline-start" />
              Seed matching event
            </Button>
            <Button type="submit">
              <Save data-icon="inline-start" />
              Submit event
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Event inbox" icon={<CheckCircle2 data-icon="inline-start" />}>
        <DataTable
          empty="No events received."
          columns={["Seq", "Created", "Type", "Status", "Subject", "Correlation", "Policy", "Runs", "Result"]}
          rows={data.events.map((event) => ({
            id: event.id,
            cells: [
              event.seq ? String(event.seq) : "-",
              new Date(event.createdAt).toLocaleString(),
              event.eventType,
              <StatusBadge status={event.status} />,
              event.subject ?? event.projectId,
              event.correlationId ? <span className="font-mono text-xs">{event.correlationId}</span> : "-",
              data.policies.find((policy) => policy.id === event.matchedPolicyId)?.name ?? "none",
              event.routing?.decisions.filter((decision) => decision.status === "routed").map((decision) =>
                data.agents.find((agent) => agent.id === decision.targetAgentId)?.name ?? decision.targetAgentId
              ).join(", ") || data.agents.find((agent) => agent.id === event.assignedAgentId)?.name || "unassigned",
              event.handlingResult ?? "No handler result."
            ],
            action: (
              <Button size="icon-sm" variant="destructive" title="Delete event" onClick={() => void remove("events", event.id)}>
                <Trash2 />
              </Button>
            )
          }))}
        />
      </Panel>
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
          <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
            <RefreshCw data-icon="inline-start" />
            Refresh
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
  id,
  disabled = false,
  onNew,
  onDelete
}: {
  newLabel: string;
  saveLabel: string;
  id?: string;
  disabled?: boolean;
  onNew: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onNew}>
        <Plus data-icon="inline-start" />
        {newLabel}
      </Button>
      <Button type="submit" disabled={disabled}>
        <Save data-icon="inline-start" />
        {saveLabel}
      </Button>
      {id ? (
        <Button type="button" variant="destructive" onClick={onDelete}>
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      ) : null}
    </div>
  );
}

type ViewProps = {
  data: AppData;
  project?: Project;
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
};
