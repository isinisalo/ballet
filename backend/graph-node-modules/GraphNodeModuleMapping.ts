import type {
  ProjectExecutionComposition,
  ProjectGraphNode,
  ProjectActionNode,
  ProjectValidationNode,
  ProjectWorkNode
} from "../../shared/domain/automation.js";
import type {
  GraphNodeModuleCompositionV6,
  GraphNodeModuleGraphNodeV6,
  GraphNodeModuleIdRemapping,
  GraphNodeModulePackageV6,
  GraphNodeModuleResourceV6
} from "../../shared/domain/graphNodeModules.js";

export function moduleRemapping(pkg: GraphNodeModulePackageV6): GraphNodeModuleIdRemapping {
  return {
    graphNode: { [pkg.graphNode.key]: pkg.manifest.id },
    nodes: Object.fromEntries(pkg.graphNode.actionNodes.flatMap((action) => [action, action.workNode, action.validationNode])
      .map((node) => [node.key, `${pkg.manifest.id}-${node.key}`])),
    instructions: Object.fromEntries(pkg.resources.filter((resource) => resource.kind === "instruction")
      .map((resource) => [resource.key, `project:${pkg.manifest.id}-${resource.key}`])),
    skills: Object.fromEntries(pkg.resources.filter((resource) => resource.kind === "skill")
      .map((resource) => [resource.key, `project:${pkg.manifest.id}-${resource.key}`]))
  };
}

export function materializeGraphNode(
  value: GraphNodeModuleGraphNodeV6,
  remap: GraphNodeModuleIdRemapping,
  profiles: Map<string, string>
): ProjectGraphNode {
  return {
    id: remap.graphNode[value.key], description: value.description,
    capabilities: structuredClone(value.capabilities), stateContract: { ...value.stateContract },
    outcomes: structuredClone(value.outcomes),
    actionNodes: value.actionNodes.map((action): ProjectActionNode => ({
      id: remap.nodes[action.key], description: action.description,
      capabilities: structuredClone(action.capabilities), maxRetries: action.maxRetries,
      outcomes: structuredClone(action.outcomes),
      workNode: materializeExecutable(action.workNode, remap, profiles) as ProjectWorkNode,
      validationNode: materializeExecutable(action.validationNode, remap, profiles) as ProjectValidationNode
    }))
  };
}

function materializeExecutable(
  value: GraphNodeModuleGraphNodeV6["actionNodes"][number]["workNode"],
  remap: GraphNodeModuleIdRemapping,
  profiles: Map<string, string>
): ProjectWorkNode | ProjectValidationNode {
  const base = {
    id: remap.nodes[value.key], description: value.description, task: value.task,
    nodeStyle: value.nodeStyle, nodeSize: value.nodeSize
  };
  return value.type === "human" ? { ...base, type: "human" } : {
    ...base, type: "agent", ...materializeComposition(value, remap, profiles)
  };
}

function materializeComposition(
  value: GraphNodeModuleCompositionV6,
  remap: GraphNodeModuleIdRemapping,
  profiles: Map<string, string>
): ProjectExecutionComposition {
  return {
    executionProfileId: profiles.get(value.profileSlot) ?? "",
    primaryInstructionId: remap.instructions[value.primaryInstruction],
    skillIds: value.skills.map((key) => remap.skills[key])
  };
}

export function dematerializeGraphNode(
  node: ProjectGraphNode,
  slots: Map<string, string>
): GraphNodeModuleGraphNodeV6 {
  return {
    key: node.id, description: node.description,
    capabilities: structuredClone(node.capabilities), stateContract: { ...node.stateContract },
    outcomes: structuredClone(node.outcomes),
    actionNodes: node.actionNodes.map((action) => ({
      key: action.id, description: action.description,
      capabilities: structuredClone(action.capabilities), maxRetries: action.maxRetries,
      outcomes: structuredClone(action.outcomes),
      workNode: dematerializeExecutable(action.workNode, slots),
      validationNode: dematerializeExecutable(action.validationNode, slots)
    }))
  };
}

function dematerializeExecutable(
  value: ProjectWorkNode | ProjectValidationNode,
  slots: Map<string, string>
): GraphNodeModuleGraphNodeV6["actionNodes"][number]["workNode"] {
  const base = {
    key: value.id, description: value.description, task: value.task,
    nodeStyle: value.nodeStyle, nodeSize: value.nodeSize
  };
  return value.type === "human" ? { ...base, type: "human" } : {
    ...base, type: "agent", ...dematerializeComposition(value, slots)
  };
}

function dematerializeComposition(value: ProjectExecutionComposition, slots: Map<string, string>) {
  const profileSlot = slots.get(value.executionProfileId);
  if (!profileSlot) throw new Error("Execution profile has no export slot.");
  return {
    profileSlot,
    primaryInstruction: localResourceKey(value.primaryInstructionId),
    skills: value.skillIds.map(localResourceKey)
  };
}

export function graphNodeCompositions(node: ProjectGraphNode): ProjectExecutionComposition[] {
  return node.actionNodes.flatMap((action) => [
    ...(action.workNode.type === "agent" ? [action.workNode] : []),
    ...(action.validationNode.type === "agent" ? [action.validationNode] : [])
  ]);
}

export function renderResource(resourceId: string, resource: GraphNodeModuleResourceV6): string {
  const localId = resourceId.slice(8);
  const title = resource.kind === "instruction" ? resource.title : resource.name;
  const date = new Date().toISOString().slice(0, 10);
  const description = resource.kind === "skill"
    ? `description: ${JSON.stringify(resource.description)}\n`
    : "";
  return `---\nid: ${localId}\ntitle: ${JSON.stringify(title)}\n${description}createdAt: ${date}\nupdatedAt: ${date}\n---\n\n${resource.body.trimEnd()}\n`;
}

export const localResourceKey = (resourceId: string) => resourceId.slice(8).replace(/^[^-]+-/, "");
