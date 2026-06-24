import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMap, parseDocument, stringify as stringifyYaml } from "yaml";
import {
  Archive,
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
  Route,
  Save,
  Sun,
  Tags,
  Trash2,
  UserRound,
  type LucideIcon
} from "lucide-react";
import type { Adr, Agent, AppData, EventRecord, Goal, MarkdownDocument, Policy, Project, ProjectDocumentTreeNode, Runtime, Skill } from "../../backend/shared/domain";
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

type View = "projects" | "project-document" | "project-goals" | "project-adrs" | "agents" | "skills" | "runtimes" | "policies" | "events";
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
  events: [],
  projectDocumentTree: []
};

const toCsv = (values: string[]) => values.join(", ");
const fromCsv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const toListText = (values?: string[]) => (values ?? []).join("\n");
const fromListText = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
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

const agentTemplate = (): Partial<Agent> => ({
  name: "",
  description: "",
  instructions: "",
  enabled: true,
  skills: []
});

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

const policyTemplate = (projectId: string, targetAgentId: string): Partial<Policy> => ({
  name: "",
  description: "",
  active: true,
  priority: 10,
  projectId,
  eventTypes: [],
  tags: [],
  source: "*",
  payloadMetadata: {},
  targetAgentId
});

const eventTemplate = (projectId: string): Partial<EventRecord> & Pick<EventRecord, "projectId" | "eventType"> => ({
  projectId,
  source: "runtime-codex",
  eventType: "deployment.failed",
  tags: ["kubernetes"],
  payload: { metadata: { severity: "high", service: "checkout-service" } }
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
  if (url.pathname === "/policies") return { view: "policies" };
  if (url.pathname === "/events") return { view: "events" };
  return { view: "projects" };
};

const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;

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

function MetadataPreview({ frontmatter }: { frontmatter?: Record<string, unknown> }) {
  const keys = Object.keys(frontmatter ?? {}).filter((key) => !["id", "title", "name", "description", "status", "createdAt", "updatedAt"].includes(key));
  if (keys.length === 0) return <span className="text-muted-foreground">No extra metadata</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {keys.slice(0, 4).map((key) => `${key}: ${JSON.stringify(frontmatter?.[key])}`).join(" · ")}
    </span>
  );
}

function BodyPreview({ body }: { body?: string }) {
  const preview = (body ?? "").replace(/^#+\s+/gm, "").trim();
  if (!preview) return <span className="text-muted-foreground">No Markdown body</span>;
  return <span className="line-clamp-2 text-muted-foreground">{preview}</span>;
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

type SidebarDocumentEntity = Pick<Agent | Skill, "id" | "name" | "relativePath">;

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
  navigate,
  themeMode,
  onThemeModeChange
}: {
  route: RouteState;
  projectDocumentTree: ProjectDocumentTreeNode[];
  agents: Agent[];
  skills: Skill[];
  navigate: (path: string) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const projectsOpen = route.view === "projects" || route.view === "project-document" || route.view === "project-goals" || route.view === "project-adrs";
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";
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
                    <SidebarDocumentList documents={agents} activePath={agentsOpen ? route.documentPath : undefined} pathFor={agentDocumentPath} navigate={navigate} />
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
              {item("Policies", <GitBranch />, "/policies", route.view === "policies")}
              {item("Events", <Inbox />, "/events", route.view === "events")}
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

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setRoute(routeFromPath(path));
  };

  const refresh = async () => {
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
  };

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(`${window.location.pathname}${window.location.search}`));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    void refresh();
  }, []);

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
              {route.view === "agents" ? <AgentsView agent={selectedAgent} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "runtimes" ? <RuntimesView data={data} save={save} remove={remove} /> : null}
              {route.view === "policies" ? <PoliciesView data={data} project={project} save={save} remove={remove} /> : null}
              {route.view === "events" ? <EventsView data={data} project={project} refresh={refresh} remove={remove} /> : null}
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

const agentFrontmatterPreview = (agent?: Agent): Record<string, unknown> | undefined => {
  if (!agent) return undefined;
  return {
    name: agent.frontmatter?.name ?? agent.name,
    model: agent.frontmatter?.model ?? agent.model,
    model_reasoning_effort: agent.frontmatter?.model_reasoning_effort ?? agent.modelReasoningEffort,
    nickname_candidates: agent.frontmatter?.nickname_candidates ?? agent.nicknameCandidates
  };
};

function AgentDocumentView({ agent }: { agent?: Agent }) {
  if (!agent) return <EmptyState title="No agent selected." />;

  return (
    <div className="grid auto-rows-min gap-4 self-start">
      <FrontmatterPanel frontmatter={agentFrontmatterPreview(agent)} />
      <article className="min-w-0 rounded-lg border bg-card p-5 md:p-8">
        {agent.errors?.length ? (
          <header className="mb-6 flex min-w-0 flex-wrap items-center gap-2 border-b pb-5">
            <ErrorPreview errors={agent.errors} />
          </header>
        ) : null}
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">description</h2>
            {agent.description ? <p className="leading-relaxed">{agent.description}</p> : <p className="text-muted-foreground">empty</p>}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">developer_instructions</h2>
            <MarkdownBody source={agent.instructions} title={agent.name} />
          </section>
        </div>
      </article>
    </div>
  );
}

function AgentsView({
  agent,
  save,
  remove,
  navigate
}: {
  agent?: Agent;
  save: ViewProps["save"];
  remove: ViewProps["remove"];
  navigate: (path: string) => void;
}) {
  const [form, setForm] = useState<Partial<Agent>>(agent ?? agentTemplate());
  const [nicknameText, setNicknameText] = useState(toListText(agent?.nicknameCandidates));

  useEffect(() => {
    setForm(agent ?? agentTemplate());
    setNicknameText(toListText(agent?.nicknameCandidates));
  }, [agent]);

  const handleSave = async () => {
    const saved = await save("agents", {
      ...form,
      nicknameCandidates: fromListText(nicknameText)
    });
    if (saved.relativePath) navigate(agentDocumentPath(saved.relativePath));
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await remove("agents", form.id);
    navigate("/agents");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title={form.id ? "Update agent" : "Create agent"} icon={<Bot data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextField label="Model" value={form.model ?? ""} onChange={(model) => setForm({ ...form, model })} />
            <TextField label="Model reasoning effort" value={form.modelReasoningEffort ?? ""} onChange={(modelReasoningEffort) => setForm({ ...form, modelReasoningEffort })} />
            <TextAreaField label="Nickname candidates" rows={4} value={nicknameText} onChange={setNicknameText} />
            <TextAreaField label="Description" required value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <TextAreaField label="Developer instructions" rows={10} required value={form.instructions ?? ""} onChange={(instructions) => setForm({ ...form, instructions })} />
          </FieldGroup>
          <CrudActions newLabel="New" saveLabel="Save agent" id={form.id} onNew={() => { setForm(agentTemplate()); setNicknameText(""); }} onDelete={handleDelete} />
        </form>
      </Panel>
      <AgentDocumentView agent={agent} />
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
      <MarkdownDocumentView document={skill} emptyTitle="No skill selected." />
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

function PoliciesView({ data, project, save, remove }: ViewProps & { project?: Project }) {
  const [form, setForm] = useState<Partial<Policy>>(policyTemplate(project?.id ?? "*", data.agents[0]?.id ?? ""));
  const [eventTypes, setEventTypes] = useState("");
  const [tags, setTags] = useState("");
  const [metadata, setMetadata] = useState("");

  const editPolicy = (policy: Policy) => {
    setForm(policy);
    setEventTypes(toCsv(policy.eventTypes));
    setTags(toCsv(policy.tags));
    setMetadata(toKeyValueLines(policy.payloadMetadata));
  };

  const submit = () => save("policies", { ...form, eventTypes: fromCsv(eventTypes), tags: fromCsv(tags), payloadMetadata: fromKeyValueLines(metadata) });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1fr)_minmax(420px,1fr)]">
      <Panel title="Policies" icon={<GitBranch data-icon="inline-start" />}>
        <DataTable
          empty="No policies yet."
          columns={["Name", "Errors", "Matches", "Target", "Metadata", "Body"]}
          rows={data.policies.map((policy) => ({
            id: policy.id,
            cells: [
              policy.name,
              <ErrorPreview errors={policy.errors} />,
              policy.eventTypes.join(", ") || "*",
              data.agents.find((agent) => agent.id === policy.targetAgentId)?.name ?? "missing agent",
              <MetadataPreview frontmatter={policy.frontmatter} />,
              <BodyPreview body={policy.body} />
            ],
            onClick: () => editPolicy(policy)
          }))}
        />
      </Panel>
      <Panel title={form.id ? "Update policy" : "Create policy"} icon={<GitBranch data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextField label="Priority" type="number" value={form.priority ?? 10} onChange={(priority) => setForm({ ...form, priority: Number(priority) })} />
            <TextAreaField label="Description" value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <SelectField
              label="Project match"
              value={form.projectId ?? project?.id ?? "*"}
              options={[{ value: "*", label: "Any project" }, ...data.projects.map((item) => ({ value: item.id, label: item.name }))]}
              onChange={(projectId) => setForm({ ...form, projectId })}
            />
            <SelectField
              label="Target agent"
              value={form.targetAgentId ?? data.agents[0]?.id ?? ""}
              options={data.agents.map((agent) => ({ value: agent.id, label: agent.name }))}
              onChange={(targetAgentId) => setForm({ ...form, targetAgentId })}
            />
            <TextField label="Event types" value={eventTypes} placeholder="deployment.failed, adr.created" onChange={setEventTypes} />
            <TextField label="Required tags" value={tags} placeholder="architecture, high-priority" onChange={setTags} />
            <TextField label="Source" value={form.source ?? "*"} onChange={(source) => setForm({ ...form, source })} />
            <SwitchField label="Active" checked={form.active ?? true} onChange={(active) => setForm({ ...form, active })} />
            <TextAreaField label="Payload metadata match (key=value)" rows={4} value={metadata} onChange={setMetadata} />
          </FieldGroup>
          <CrudActions
            newLabel="New"
            saveLabel="Save policy"
            id={form.id}
            disabled={data.agents.length === 0}
            onNew={() => { setForm(policyTemplate(project?.id ?? "*", data.agents[0]?.id ?? "")); setEventTypes(""); setTags(""); setMetadata(""); }}
            onDelete={() => void remove("policies", form.id!)}
          />
        </form>
      </Panel>
    </div>
  );
}

function EventsView({ data, project, refresh, remove }: { data: AppData; project?: Project; refresh: () => Promise<void>; remove: (collection: SaveCollection | "events", id: string) => Promise<void> }) {
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
      await api.intakeEvent({ ...form, payload: parsePayload(payloadText), tags: form.tags ?? [] });
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
          columns={["Created", "Type", "Status", "Errors", "Policy", "Agent", "Metadata", "Body", "Result"]}
          rows={data.events.map((event) => ({
            id: event.id,
            cells: [
              new Date(event.createdAt).toLocaleString(),
              event.eventType,
              <StatusBadge status={event.status} />,
              <ErrorPreview errors={event.errors} />,
              data.policies.find((policy) => policy.id === event.matchedPolicyId)?.name ?? "none",
              data.agents.find((agent) => agent.id === event.assignedAgentId)?.name ?? "unassigned",
              <MetadataPreview frontmatter={event.frontmatter} />,
              <BodyPreview body={event.body} />,
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
