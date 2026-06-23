import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Code2,
  FileText,
  GitBranch,
  Inbox,
  Layers3,
  Menu,
  Plus,
  RefreshCw,
  Route,
  Save,
  Trash2
} from "lucide-react";
import type { Adr, Agent, AppData, EventRecord, Goal, Policy, Project, Runtime, Skill } from "../shared/domain";
import { seedData } from "../shared/seed";
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

const projectTemplate = (): Partial<Project> => ({
  name: "",
  key: "",
  description: "",
  status: "active"
});

const goalTemplate = (projectId: string): Partial<Goal> => ({
  projectId,
  title: "",
  description: "",
  status: "not-started",
  targetDate: "",
  owner: ""
});

const adrTemplate = (projectId: string): Partial<Adr> => ({
  projectId,
  title: "",
  context: "",
  decision: "",
  consequences: "",
  status: "proposed"
});

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

function SummaryTiles({ data }: { data: AppData }) {
  const routed = data.events.filter((event) => event.status === "routed").length;
  const unassigned = data.events.filter((event) => event.status === "unassigned").length;
  const tiles = [
    { label: "Projects", value: data.projects.length },
    { label: "Agents", value: data.agents.length },
    { label: "Active policies", value: data.policies.filter((policy) => policy.active).length },
    { label: "Routed / unassigned", value: `${routed}/${unassigned}` }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} size="sm">
          <CardHeader>
            <CardTitle className="text-2xl">{tile.value}</CardTitle>
            <CardDescription className="font-medium uppercase">{tile.label}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
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

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function AppSidebar({
  route,
  selectedProjectId,
  navigate
}: {
  route: RouteState;
  selectedProjectId: string;
  navigate: (path: string) => void;
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
                    <SidebarMenuButton isActive={projectsOpen} tooltip="Projects">
                      <Layers3 />
                      <span>Projects</span>
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
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          href={projectAdrsPath}
                          isActive={route.view === "project-adrs"}
                          onClick={(event) => { event.preventDefault(); navigate(projectAdrsPath); }}
                        >
                          <span>ADR</span>
                        </SidebarMenuSubButton>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Build verified">
              <CheckCircle2 />
              <span>Build verified</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  );
}

export function App() {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [route, setRoute] = useState<RouteState>(() => routeFromPath(window.location.pathname));
  const [selectedProjectId, setSelectedProjectId] = useState(seedData.projects[0]?.id ?? "");

  const project = data.projects.find((item) => item.id === (route.projectId ?? selectedProjectId)) ?? data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0];

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

  const reset = async () => {
    const next = await api.reset();
    setData(next);
    const firstProjectId = next.projects[0]?.id ?? "";
    setSelectedProjectId(firstProjectId);
    setNotice("Seed data restored.");
    if (route.view === "project-goals") navigate(routePath("project-goals", firstProjectId));
    if (route.view === "project-adrs") navigate(routePath("project-adrs", firstProjectId));
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (route.view === "project-goals") navigate(routePath("project-goals", projectId));
    if (route.view === "project-adrs") navigate(routePath("project-adrs", projectId));
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar route={route} selectedProjectId={selectedProjectId} navigate={navigate} />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <main className="flex min-h-svh flex-col gap-5 bg-muted/30 p-4 md:p-6">
              <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-2">
                  <SidebarTrigger className="md:hidden">
                    <Menu />
                  </SidebarTrigger>
                  <PageHeader title="Project operations" description="Projects, decisions, agents, runtimes, policies, and routed event intake." />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                  <Select value={selectedProjectId} onValueChange={handleProjectSelect}>
                    <SelectTrigger className="w-full sm:w-[22rem]">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {data.projects.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.key} · {item.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => navigate("/events")}>
                    <Inbox data-icon="inline-start" />
                    Event intake
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    <RefreshCw data-icon="inline-start" />
                    Reset seed
                  </Button>
                </div>
              </header>

              {loading ? <Alert><AlertDescription>Loading workspace data...</AlertDescription></Alert> : null}
              {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
              {notice ? <Alert><AlertDescription>{notice}</AlertDescription></Alert> : null}
              <SummaryTiles data={data} />

              {route.view === "projects" ? (
                <ProjectsOverview
                  data={data}
                  project={project}
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                  navigate={navigate}
                  save={save}
                  remove={remove}
                />
              ) : null}
              {route.view === "project-goals" ? <GoalsPage data={data} project={project} save={save} remove={remove} /> : null}
              {route.view === "project-adrs" ? <AdrsPage data={data} project={project} save={save} remove={remove} /> : null}
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

function ProjectsOverview({
  data,
  project,
  selectedProjectId,
  setSelectedProjectId,
  navigate,
  save,
  remove
}: {
  data: AppData;
  project?: Project;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  navigate: (path: string) => void;
  save: <T extends SaveCollection>(collection: T, item: Partial<AppData[T][number]>) => Promise<AppData[T][number]>;
  remove: (collection: SaveCollection | "events", id: string) => Promise<void>;
}) {
  const [projectForm, setProjectForm] = useState<Partial<Project>>(projectTemplate());

  useEffect(() => {
    setProjectForm(project ?? projectTemplate());
  }, [project?.id]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <Panel title="Projects Overview" description="Select the project used by the GOALS and ADR pages." icon={<Layers3 data-icon="inline-start" />}>
        <DataTable
          empty="No projects yet."
          columns={["Key", "Name", "Status", "Goals", "ADRs"]}
          rows={data.projects.map((item) => ({
            id: item.id,
            cells: [
              <span className="font-medium">{item.key}</span>,
              item.name,
              <StatusBadge status={item.status} />,
              data.goals.filter((goal) => goal.projectId === item.id).length,
              data.adrs.filter((adr) => adr.projectId === item.id).length
            ],
            onClick: () => {
              setSelectedProjectId(item.id);
              setProjectForm(item);
            }
          }))}
        />
      </Panel>

      <Panel title={projectForm.id ? "Update project" : "Create project"} icon={<Layers3 data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void save("projects", projectForm); }}>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <TextField label="Name" required value={projectForm.name ?? ""} onChange={(name) => setProjectForm({ ...projectForm, name })} />
            <TextField label="Key" required value={projectForm.key ?? ""} onChange={(key) => setProjectForm({ ...projectForm, key })} />
            <SelectField
              label="Status"
              value={projectForm.status ?? "active"}
              options={["active", "paused", "archived"].map((value) => ({ value, label: value }))}
              onChange={(status) => setProjectForm({ ...projectForm, status: status as Project["status"] })}
            />
          </FieldGroup>
          <TextAreaField label="Description" value={projectForm.description ?? ""} onChange={(description) => setProjectForm({ ...projectForm, description })} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setProjectForm(projectTemplate())}>
              <Plus data-icon="inline-start" />
              New
            </Button>
            {selectedProjectId ? (
              <>
                <Button type="button" variant="secondary" onClick={() => navigate(routePath("project-goals", selectedProjectId))}>Open GOALS</Button>
                <Button type="button" variant="secondary" onClick={() => navigate(routePath("project-adrs", selectedProjectId))}>Open ADR</Button>
              </>
            ) : null}
            <Button type="submit">
              <Save data-icon="inline-start" />
              Save project
            </Button>
            {projectForm.id ? (
              <Button type="button" variant="destructive" onClick={() => void remove("projects", projectForm.id!)}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function GoalsPage({ data, project, save, remove }: ViewProps & { project?: Project }) {
  const [goalForm, setGoalForm] = useState<Partial<Goal>>(goalTemplate(project?.id ?? ""));
  const goals = useMemo(() => data.goals.filter((goal) => goal.projectId === project?.id), [data.goals, project?.id]);

  useEffect(() => {
    setGoalForm(goalTemplate(project?.id ?? ""));
  }, [project?.id]);

  if (!project) return <EmptyState title="No project selected." action="Select or create a Project before managing GOALS." />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1.1fr)_minmax(360px,0.9fr)]">
      <Panel title="Project GOALS" description={`Goals for ${project.key} · ${project.name}.`} icon={<ClipboardList data-icon="inline-start" />}>
        <DataTable
          empty="No Goals exist for this Project."
          columns={["Title", "Status", "Owner", "Target"]}
          rows={goals.map((goal) => ({
            id: goal.id,
            cells: [goal.title, <StatusBadge status={goal.status} />, goal.owner || "Unassigned", goal.targetDate || "Not set"],
            onClick: () => setGoalForm(goal)
          }))}
        />
      </Panel>

      <Panel title={goalForm.id ? "Update goal" : "Add goal"} icon={<ClipboardList data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void save("goals", { ...goalForm, projectId: project.id }); }}>
          <FieldGroup>
            <TextField label="Title" required value={goalForm.title ?? ""} onChange={(title) => setGoalForm({ ...goalForm, title })} />
            <SelectField
              label="Status"
              value={goalForm.status ?? "not-started"}
              options={["not-started", "in-progress", "at-risk", "done"].map((value) => ({ value, label: value }))}
              onChange={(status) => setGoalForm({ ...goalForm, status: status as Goal["status"] })}
            />
            <TextField label="Owner" value={goalForm.owner ?? ""} onChange={(owner) => setGoalForm({ ...goalForm, owner })} />
            <TextField label="Target date" type="date" value={goalForm.targetDate ?? ""} onChange={(targetDate) => setGoalForm({ ...goalForm, targetDate })} />
            <TextAreaField label="Description" value={goalForm.description ?? ""} onChange={(description) => setGoalForm({ ...goalForm, description })} />
          </FieldGroup>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setGoalForm(goalTemplate(project.id))}>
              <Plus data-icon="inline-start" />
              New
            </Button>
            <Button type="submit">
              <Save data-icon="inline-start" />
              Save goal
            </Button>
            {goalForm.id ? (
              <Button type="button" variant="destructive" onClick={() => void remove("goals", goalForm.id!)}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function AdrsPage({ data, project, save, remove }: ViewProps & { project?: Project }) {
  const [adrForm, setAdrForm] = useState<Partial<Adr>>(adrTemplate(project?.id ?? ""));
  const adrs = useMemo(() => data.adrs.filter((adr) => adr.projectId === project?.id), [data.adrs, project?.id]);

  useEffect(() => {
    setAdrForm(adrTemplate(project?.id ?? ""));
  }, [project?.id]);

  if (!project) return <EmptyState title="No project selected." action="Select or create a Project before managing ADRs." />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1.1fr)_minmax(360px,0.9fr)]">
      <Panel title="Project ADR" description={`Architecture Decision Records for ${project.key} · ${project.name}.`} icon={<FileText data-icon="inline-start" />}>
        <DataTable
          empty="No ADRs exist for this Project."
          columns={["Title", "Status", "Updated"]}
          rows={adrs.map((adr) => ({
            id: adr.id,
            cells: [adr.title, <StatusBadge status={adr.status} />, new Date(adr.updatedAt).toLocaleDateString()],
            onClick: () => setAdrForm(adr)
          }))}
        />
      </Panel>

      <Panel title={adrForm.id ? "Update ADR" : "Add ADR"} icon={<FileText data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void save("adrs", { ...adrForm, projectId: project.id }); }}>
          <FieldGroup>
            <TextField label="Title" required value={adrForm.title ?? ""} onChange={(title) => setAdrForm({ ...adrForm, title })} />
            <SelectField
              label="Status"
              value={adrForm.status ?? "proposed"}
              options={["proposed", "accepted", "superseded", "rejected"].map((value) => ({ value, label: value }))}
              onChange={(status) => setAdrForm({ ...adrForm, status: status as Adr["status"] })}
            />
            <TextAreaField label="Context" required value={adrForm.context ?? ""} onChange={(context) => setAdrForm({ ...adrForm, context })} />
            <TextAreaField label="Decision" required value={adrForm.decision ?? ""} onChange={(decision) => setAdrForm({ ...adrForm, decision })} />
            <TextAreaField label="Consequences" required value={adrForm.consequences ?? ""} onChange={(consequences) => setAdrForm({ ...adrForm, consequences })} />
          </FieldGroup>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdrForm(adrTemplate(project.id))}>
              <Plus data-icon="inline-start" />
              New
            </Button>
            <Button type="submit">
              <Save data-icon="inline-start" />
              Save ADR
            </Button>
            {adrForm.id ? (
              <Button type="button" variant="destructive" onClick={() => void remove("adrs", adrForm.id!)}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
    </div>
  );
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
          columns={["Name", "Enabled", "Skills"]}
          rows={data.agents.map((agent) => ({
            id: agent.id,
            cells: [agent.name, agent.enabled ? "enabled" : "disabled", String(agent.skills.length)],
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
          columns={["Name", "Matches", "Target"]}
          rows={data.policies.map((policy) => ({
            id: policy.id,
            cells: [
              policy.name,
              policy.eventTypes.join(", ") || "*",
              data.agents.find((agent) => agent.id === policy.targetAgentId)?.name ?? "missing agent"
            ],
            onClick: () => editPolicy(policy)
          }))}
        />
      </Panel>
      <Panel title={form.id ? "Update policy" : "Create policy"} icon={<GitBranch data-icon="inline-start" />}>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <FieldGroup>
            <TextField label="Name" required value={form.name ?? ""} onChange={(name) => setForm({ ...form, name })} />
            <TextAreaField label="Description" value={form.description ?? ""} onChange={(description) => setForm({ ...form, description })} />
            <SelectField
              label="Project match"
              value={form.projectId ?? project?.id ?? "*"}
              options={[{ value: "*", label: "Any project" }, ...data.projects.map((item) => ({ value: item.id, label: `${item.key} · ${item.name}` }))]}
              onChange={(projectId) => setForm({ ...form, projectId })}
            />
            <SelectField
              label="Target agent"
              value={form.targetAgentId ?? data.agents[0]?.id ?? ""}
              options={data.agents.map((agent) => ({ value: agent.id, label: agent.name }))}
              onChange={(targetAgentId) => setForm({ ...form, targetAgentId })}
            />
            <TextField label="Event types" value={eventTypes} placeholder="deployment.failed, adr.created" onChange={setEventTypes} />
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
              options={data.projects.map((item) => ({ value: item.id, label: `${item.key} · ${item.name}` }))}
              onChange={(projectId) => setForm({ ...form, projectId })}
            />
            <TextField label="Event type" required value={form.eventType} onChange={(eventType) => setForm({ ...form, eventType })} />
            <TextField label="Source agent/runtime" value={form.source ?? ""} onChange={(source) => setForm({ ...form, source })} />
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
          columns={["Created", "Type", "Status", "Policy", "Agent", "Result"]}
          rows={data.events.map((event) => ({
            id: event.id,
            cells: [
              new Date(event.createdAt).toLocaleString(),
              event.eventType,
              <StatusBadge status={event.status} />,
              data.policies.find((policy) => policy.id === event.matchedPolicyId)?.name ?? "none",
              data.agents.find((agent) => agent.id === event.assignedAgentId)?.name ?? "unassigned",
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
