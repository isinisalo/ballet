import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  GitBranch,
  Inbox,
  Layers3,
  Menu,
  Monitor,
  Moon,
  Plus,
  Route,
  Save,
  Sun,
  Trash2,
  type LucideIcon
} from "lucide-react";
import type { Adr, Agent, AppData, EventRecord, Goal, Policy, Project, Runtime, Skill } from "../../backend/shared/domain";
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

type View = "projects" | "project-goals" | "project-adrs" | "agents" | "runtimes" | "policies" | "events";
type SaveCollection = "projects" | "goals" | "adrs" | "agents" | "runtimes" | "policies";

interface RouteState {
  view: View;
  projectId?: string;
}

const emptyData: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  runtimes: [],
  policies: [],
  events: []
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

const agentTemplate = (): Partial<Agent> => ({
  name: "",
  description: "",
  instructions: "",
  enabled: true,
  skills: []
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
  const goalsMatch = path.match(/^\/projects\/([^/]+)\/goals\/?$/);
  if (goalsMatch) return { view: "project-goals", projectId: decodeURIComponent(goalsMatch[1]) };

  const adrsMatch = path.match(/^\/projects\/([^/]+)\/adrs\/?$/);
  if (adrsMatch) return { view: "project-adrs", projectId: decodeURIComponent(adrsMatch[1]) };

  if (path === "/agents") return { view: "agents" };
  if (path === "/runtimes") return { view: "runtimes" };
  if (path === "/policies") return { view: "policies" };
  if (path === "/events") return { view: "events" };
  return { view: "projects" };
};

const routePath = (view: View, projectId?: string) => {
  if (view === "project-goals") return `/projects/${encodeURIComponent(projectId ?? "")}/goals`;
  if (view === "project-adrs") return `/projects/${encodeURIComponent(projectId ?? "")}/adrs`;
  if (view === "projects") return "/projects";
  return `/${view}`;
};

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

type MarkdownEntity = Pick<Project | Goal | Adr, "id" | "frontmatter" | "body" | "relativePath" | "errors" | "createdAt" | "updatedAt"> & {
  name?: string;
  title?: string;
  status?: string;
  targetDate?: string;
  owner?: string;
};

const documentTitle = (document: MarkdownEntity) =>
  document.title || document.name || (typeof document.frontmatter?.title === "string" ? document.frontmatter.title : undefined) || document.id;

const documentStatus = (document: MarkdownEntity): string =>
  typeof document.frontmatter?.status === "string" ? document.frontmatter.status : document.status ?? "";

const isSimpleFrontmatterValue = (value: unknown) => value === null || ["string", "number", "boolean", "undefined"].includes(typeof value);
const isSimpleFrontmatterArray = (value: unknown[]) => value.every(isSimpleFrontmatterValue);

function FrontmatterValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    if (isSimpleFrontmatterArray(value)) {
      return (
        <span className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <Badge key={`${String(item)}-${index}`} variant={fieldKey === "tags" ? "outline" : "secondary"}>
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
  if (fieldKey === "status") return <StatusBadge status={String(value)} />;
  return <span>{String(value)}</span>;
}

function FrontmatterPanel({ frontmatter }: { frontmatter?: Record<string, unknown> }) {
  const entries = Object.entries(frontmatter ?? {});

  return (
    <aside className="rounded-lg border bg-card p-3">
      <h2 className="text-xs font-semibold uppercase text-muted-foreground">Frontmatter</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No frontmatter.</p>
      ) : (
        <dl className="mt-2 flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className={cn(
                "min-w-0 rounded-md border bg-background px-2.5 py-1.5",
                value && typeof value === "object" && !Array.isArray(value) ? "basis-full" : "max-w-full"
              )}
            >
              <dt className="mb-1 font-mono text-[0.65rem] uppercase leading-none text-muted-foreground">{key}</dt>
              <dd className="min-w-0 break-words text-sm leading-snug">
                <FrontmatterValue fieldKey={key} value={value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

function MarkdownBody({ source }: { source?: string }) {
  const body = source?.trim();
  if (!body) return <p className="text-muted-foreground">No Markdown body.</p>;

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}

function MarkdownDocumentView({ document, emptyTitle }: { document?: MarkdownEntity; emptyTitle: string }) {
  if (!document) return <EmptyState title={emptyTitle} />;
  const status = documentStatus(document);

  return (
    <div className="grid gap-4">
      <FrontmatterPanel frontmatter={document.frontmatter} />
      <article className="min-w-0 rounded-lg border bg-card p-5 md:p-8">
        <header className="mb-6 grid gap-3 border-b pb-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {status ? <StatusBadge status={status} /> : null}
            {document.relativePath ? <Badge variant="outline" className="min-w-0 max-w-full shrink truncate">{document.relativePath}</Badge> : null}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{documentTitle(document)}</h2>
          {document.errors?.length ? <ErrorPreview errors={document.errors} /> : null}
        </header>
        <MarkdownBody source={document.body} />
      </article>
    </div>
  );
}

function SidebarDocumentLinks({
  documents,
  selectedId,
  onSelect,
  path
}: {
  documents: MarkdownEntity[];
  selectedId?: string;
  onSelect: (id: string) => void;
  path: string;
}) {
  if (documents.length === 0) return null;

  return (
    <SidebarMenuSub className="mx-2 mt-1 gap-0.5 border-sidebar-border/60 px-2 py-1">
      {documents.map((document) => (
        <SidebarMenuSubItem key={document.id}>
          <SidebarMenuSubButton
            href={path}
            size="sm"
            isActive={document.id === selectedId}
            className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
            onClick={(event) => {
              event.preventDefault();
              onSelect(document.id);
            }}
          >
            <span>{documentTitle(document)}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
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
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea value={value} rows={rows} required={required} onChange={(event) => onChange(event.target.value)} />
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

function Panel({ title, description, icon, children, action }: { title: string; description?: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
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
  selectedProjectId,
  goals,
  adrs,
  selectedGoalId,
  selectedAdrId,
  onSelectGoal,
  onSelectAdr,
  navigate,
  themeMode,
  onThemeModeChange
}: {
  route: RouteState;
  selectedProjectId: string;
  goals: MarkdownEntity[];
  adrs: MarkdownEntity[];
  selectedGoalId?: string;
  selectedAdrId?: string;
  onSelectGoal: (id: string) => void;
  onSelectAdr: (id: string) => void;
  navigate: (path: string) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const projectGoalsPath = selectedProjectId ? routePath("project-goals", selectedProjectId) : "/projects";
  const projectAdrsPath = selectedProjectId ? routePath("project-adrs", selectedProjectId) : "/projects";
  const projectsOpen = route.view === "projects" || route.view === "project-goals" || route.view === "project-adrs";
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
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          href="/projects"
                          isActive={route.view === "projects"}
                          onClick={(event) => { event.preventDefault(); navigate("/projects"); }}
                        >
                          <span>Overview</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          href={projectGoalsPath}
                          isActive={route.view === "project-goals"}
                          onClick={(event) => { event.preventDefault(); navigate(projectGoalsPath); }}
                        >
                          <span>GOALS</span>
                        </SidebarMenuSubButton>
                        {route.view === "project-goals" ? (
                          <SidebarDocumentLinks
                            documents={goals}
                            selectedId={selectedGoalId}
                            path={projectGoalsPath}
                            onSelect={(id) => {
                              onSelectGoal(id);
                              navigate(projectGoalsPath);
                            }}
                          />
                        ) : null}
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          href={projectAdrsPath}
                          isActive={route.view === "project-adrs"}
                          onClick={(event) => { event.preventDefault(); navigate(projectAdrsPath); }}
                        >
                          <span>ADR</span>
                        </SidebarMenuSubButton>
                        {route.view === "project-adrs" ? (
                          <SidebarDocumentLinks
                            documents={adrs}
                            selectedId={selectedAdrId}
                            path={projectAdrsPath}
                            onSelect={(id) => {
                              onSelectAdr(id);
                              navigate(projectAdrsPath);
                            }}
                          />
                        ) : null}
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              {item("Agents", <Bot />, "/agents", route.view === "agents")}
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
  const [route, setRoute] = useState<RouteState>(() => routeFromPath(window.location.pathname));
  const [selectedProjectId, setSelectedProjectId] = useState(seedData.projects[0]?.id ?? "");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedAdrId, setSelectedAdrId] = useState("");

  const project = data.projects.find((item) => item.id === (route.projectId ?? selectedProjectId)) ?? data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0];
  const goals = useMemo(() => data.goals.filter((goal) => goal.projectId === project?.id), [data.goals, project?.id]);
  const adrs = useMemo(() => data.adrs.filter((adr) => adr.projectId === project?.id), [data.adrs, project?.id]);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0];
  const selectedAdr = adrs.find((adr) => adr.id === selectedAdrId) ?? adrs[0];

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
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
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
          selectedProjectId={selectedProjectId}
          goals={goals}
          adrs={adrs}
          selectedGoalId={selectedGoal?.id}
          selectedAdrId={selectedAdr?.id}
          onSelectGoal={setSelectedGoalId}
          onSelectAdr={setSelectedAdrId}
          navigate={navigate}
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
        />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <main className="flex min-h-svh flex-col gap-5 bg-muted/30 p-4 md:p-6">
              <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                />
              ) : null}
              {route.view === "project-goals" ? <GoalsPage project={project} selectedGoal={selectedGoal} /> : null}
              {route.view === "project-adrs" ? <AdrsPage project={project} selectedAdr={selectedAdr} /> : null}
              {route.view === "agents" ? <AgentsView data={data} save={save} remove={remove} /> : null}
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

function ProjectsOverview({ project }: { project?: Project }) {
  return (
    <MarkdownDocumentView document={project} emptyTitle="No project document found." />
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

function AgentsView({ data, save, remove }: ViewProps) {
  const [form, setForm] = useState<Partial<Agent>>(agentTemplate());
  const [skillsText, setSkillsText] = useState("");

  const editAgent = (agent: Agent) => {
    setForm(agent);
    setSkillsText(agent.skills.map((skill) => `${skill.name} | ${skill.description} | ${toKeyValueLines(skill.metadata).replace(/\n/g, "; ")}`).join("\n"));
  };

  const parseSkills = (): Skill[] =>
    skillsText.split("\n").map((line, index) => {
      const [name = "", description = "", metadataText = ""] = line.split("|").map((part) => part.trim());
      return {
        id: form.skills?.[index]?.id ?? `skill-${Date.now()}-${index}`,
        name,
        description,
        metadata: fromKeyValueLines(metadataText.replace(/;/g, "\n"))
      };
    }).filter((skill) => skill.name);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1fr)_minmax(420px,1fr)]">
      <Panel title="Agents" icon={<Bot data-icon="inline-start" />}>
        <DataTable
          empty="No agents yet."
          columns={["Name", "Enabled", "Errors", "Skills", "Metadata", "Body"]}
          rows={data.agents.map((agent) => ({
            id: agent.id,
            cells: [
              agent.name,
              agent.enabled ? "enabled" : "disabled",
              <ErrorPreview errors={agent.errors} />,
              String(agent.skills.length),
              <MetadataPreview frontmatter={agent.frontmatter} />,
              <BodyPreview body={agent.body} />
            ],
            onClick: () => editAgent(agent)
          }))}
        />
      </Panel>
      <Panel title={form.id ? "Update agent" : "Create agent"} icon={<Bot data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void save("agents", { ...form, skills: parseSkills() }); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <SwitchField label="Enabled" checked={form.enabled ?? true} onChange={(enabled) => setForm({ ...form, enabled })} />
            <TextAreaField label="Description" value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <TextAreaField label="Instructions" rows={6} required value={form.instructions ?? ""} onChange={(instructions) => setForm({ ...form, instructions })} />
            <TextAreaField label="Skills (name | description | key=value; key=value)" rows={6} value={skillsText} onChange={setSkillsText} />
          </FieldGroup>
          <CrudActions newLabel="New" saveLabel="Save agent" id={form.id} onNew={() => { setForm(agentTemplate()); setSkillsText(""); }} onDelete={() => void remove("agents", form.id!)} />
        </form>
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
