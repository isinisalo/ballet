import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Archive,
  CheckCircle2,
  Eye,
  FileKey2,
  FileText,
  Menu,
  Plus,
  Save
} from "lucide-react";
import type {
  AppData,
} from "../../../shared/api/workspace-contracts";
import type { Agent } from "../../../shared/api/workspace-contracts";
import type { ProjectAutomationConfig } from "../../../shared/api/workspace-contracts";
import type {
  MarkdownDocument,
  Project
} from "../../../shared/api/workspace-contracts";
import type { Runtime } from "../../../shared/api/workspace-contracts";
import { seedData } from "../../../shared/seed";
import { api } from "../api";
import { frontmatterToYaml, parseFrontmatterYaml } from "./documents/frontmatter";
import { markdownPreviewDocument, type MarkdownEntity } from "./documents/markdownDocument";
import { MarkdownDocumentView } from "./documents/MarkdownDocumentView";
import {
  createKindForProjectDocument,
  findProjectTreeDirectory,
  findProjectTreeDocument,
  projectDocumentCreateConfig,
  selectedProjectTreeDocument
} from "./documents/projectDocuments";
import {
  agentDocumentPath,
  projectCollectionDocumentPath,
  projectDocumentPath
} from "./routing";
import { emptyData, type ProjectDocumentCreateKind, type SaveCollection } from "./types";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { AppSidebar } from "./layout/AppSidebar";
import { AgentEditor } from "./agents/AgentEditor";
import { SkillsView } from "./skills/SkillsView";
import { AutomationView, RuntimesView } from "./automation/AutomationView";
import { automationConfigTemplate } from "./automation/automationUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  EmptyState,
  Panel,
  TextAreaField,
  TextField
} from "@/components/shared/workspace-ui";
import { useNotifications } from "../app/notifications";
import { useRuntimeStream } from "../app/useRuntimeStream";

export function WorkspaceShell() {
  const { notifications, notify } = useNotifications();
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const { route, navigate } = useWorkspaceNavigation();
  const [selectedProjectId, setSelectedProjectId] = useState(seedData.projects[0]?.id ?? "");
  const [createDocumentKind, setCreateDocumentKind] = useState<ProjectDocumentCreateKind | null>(null);
  const runtimeNotificationRef = useRef<{ status: "reconnecting" | "disconnected"; id: string } | null>(null);

  const project = data.projects.find((item) => item.id === (route.projectId ?? selectedProjectId)) ?? data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0];
  const projectDocumentTree = data.projectDocumentTree ?? [];
  const selectedProjectDocument = useMemo(
    () => findProjectTreeDocument(projectDocumentTree, route.documentPath),
    [projectDocumentTree, route.documentPath]
  );
  const adrDirectory = useMemo(
    () => findProjectTreeDirectory(projectDocumentTree, ".ballet/adr"),
    [projectDocumentTree]
  );
  const goalsDirectory = useMemo(
    () => findProjectTreeDirectory(projectDocumentTree, ".ballet/goals"),
    [projectDocumentTree]
  );
  const instructionsDirectory = useMemo(
    () => findProjectTreeDirectory(projectDocumentTree, ".ballet/instructions"),
    [projectDocumentTree]
  );
  const selectedAdr = useMemo(
    () => selectedProjectTreeDocument(adrDirectory, route.documentPath),
    [adrDirectory, route.documentPath]
  );
  const selectedGoal = useMemo(
    () => selectedProjectTreeDocument(goalsDirectory, route.documentPath),
    [goalsDirectory, route.documentPath]
  );
  const selectedInstruction = useMemo(
    () => selectedProjectTreeDocument(instructionsDirectory, route.documentPath),
    [instructionsDirectory, route.documentPath]
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

  const refresh = useCallback(async () => {
    setLoading(true);
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
      notify({ type: "error", message: err instanceof Error ? err.message : "Failed to load data." });
    } finally {
      setLoading(false);
    }
  }, [notify, route.projectId, selectedProjectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runtimeStreamStatus = useRuntimeStream(refresh);

  useEffect(() => {
    if (runtimeStreamStatus !== "reconnecting" && runtimeStreamStatus !== "disconnected") {
      runtimeNotificationRef.current = null;
      return;
    }

    const current = runtimeNotificationRef.current;
    const currentIsVisible = current ? notifications.some((notification) => notification.id === current.id) : false;
    if (current?.status === runtimeStreamStatus && currentIsVisible) return;

    const id = notify({
      type: runtimeStreamStatus === "disconnected" ? "error" : "info",
      message: `Runtime stream ${runtimeStreamStatus}. Live updates will resume automatically.`
    });
    runtimeNotificationRef.current = { status: runtimeStreamStatus, id };
  }, [notifications, notify, runtimeStreamStatus]);

  useEffect(() => {
    if (route.projectId) setSelectedProjectId(route.projectId);
  }, [route.projectId]);

  const runMutation = async <T,>(action: () => Promise<T>, successMessage: string, fallbackError: string) => {
    try {
      const result = await action();
      await refresh();
      notify({ type: "info", message: successMessage });
      return result;
    } catch (err) {
      notify({ type: "error", message: err instanceof Error ? err.message : fallbackError });
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
    navigate(project?.id ? projectCollectionDocumentPath(project.id, kind, saved.relativePath) : projectDocumentPath(saved.relativePath));
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
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectId={project?.id}
          projectDocumentTree={projectDocumentTree}
          automation={data.automation ?? automationConfigTemplate()}
          agents={data.agents}
          skills={data.skills}
          navigate={navigate}
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
              {route.view === "automation" ? <AutomationView data={data} activeTab={route.automationTab ?? "workflows"} selectedId={route.automationEntityId} saveAutomation={saveAutomation} navigate={navigate} /> : null}
              {route.view === "runtimes" ? <RuntimesView data={data} selectedId={route.runtimeId} saveAutomation={saveAutomation} navigate={navigate} /> : null}
              {route.view === "agents" ? <AgentsView agent={selectedAgent} runtimes={data.runtimes} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
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

  const previewDocument = useMemo(
    () => document ? markdownPreviewDocument(document, frontmatterText, bodyText, parseFrontmatterYaml) : undefined,
    [bodyText, document, frontmatterText]
  );

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
        <MarkdownDocumentView document={previewDocument} emptyTitle={emptyTitle} compact embedded />
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

function GoalsPage({ project, selectedGoal, onCreateDocument }: { project?: Project; selectedGoal?: MarkdownEntity; onCreateDocument: (kind: ProjectDocumentCreateKind) => void }) {
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

function AdrsPage({ project, selectedAdr, onCreateDocument }: { project?: Project; selectedAdr?: MarkdownEntity; onCreateDocument: (kind: ProjectDocumentCreateKind) => void }) {
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
  selectedInstruction?: MarkdownEntity;
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
    } catch {
      // Async create failures are surfaced by the shared mutation notification layer.
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
