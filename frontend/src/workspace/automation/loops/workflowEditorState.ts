import {
  defaultLoopNodeSize,
  defaultLoopNodeStyle,
  isProjectProviderJobNode,
  type ProjectAutomationConfig,
  type ProjectFailEdge,
  type ProjectJobNode,
  type ProjectLoop,
  type ProjectPassEdge,
  type ProjectPassEdgeTarget,
  type ProjectValidationNode
} from "@shared/api/workspace-contracts";
import { defaultOnceSchedule } from "./loopSchedulePresentation";

export const createJobNodeDraft = (id = "job"): ProjectJobNode => ({
  id,
  description: "",
  validationNodeId: `${id}-validation`,
  maxRetries: 3,
  type: "agent",
  task: "",
  executionProfileId: "",
  primaryInstructionId: "",
  skillIds: [],
  nodeStyle: defaultLoopNodeStyle,
  nodeSize: defaultLoopNodeSize
});

export const createValidationNodeDraft = (id = "job-validation"): ProjectValidationNode => ({
  id,
  description: "",
  type: "human",
  task: "",
  nodeStyle: defaultLoopNodeStyle,
  nodeSize: defaultLoopNodeSize
});

export const nextJobNodeId = (config: ProjectAutomationConfig, loop: ProjectLoop): string => uniqueId(
  [
    ...config.loops.flatMap((candidate) => candidate.workflow.jobNodes.map((node) => node.id)),
    ...loop.workflow.jobNodes.map((node) => node.id)
  ],
  `${loop.id.trim() || "loop"}-job`
);

export const addJobPair = (
  loop: ProjectLoop,
  job = createJobNodeDraft(uniqueId(loop.workflow.jobNodes.map((candidate) => candidate.id), "job")),
  validation = createValidationNodeDraft(job.validationNodeId)
): ProjectLoop => ({
  ...loop,
  workflow: {
    ...loop.workflow,
    startJobNodeId: loop.workflow.jobNodes.length === 0 ? job.id : loop.workflow.startJobNodeId,
    jobNodes: [...loop.workflow.jobNodes, job],
    validationNodes: [...loop.workflow.validationNodes, validation],
    passEdges: [...loop.workflow.passEdges, {
      id: uniqueId(loop.workflow.passEdges.map((edge) => edge.id), `${loop.id}-${job.id}-pass`),
      sourceValidationNodeId: validation.id,
      target: { workflowResult: "PASS" }
    }],
    failEdges: [...loop.workflow.failEdges, {
      id: uniqueId(loop.workflow.failEdges.map((edge) => edge.id), `${loop.id}-${job.id}-fail`),
      sourceValidationNodeId: validation.id,
      target: { workflowResult: "FAIL" }
    }]
  }
});

export const replaceJobNode = (
  loop: ProjectLoop,
  previousId: string,
  job: ProjectJobNode
): ProjectLoop => ({
  ...loop,
  workflow: {
    ...loop.workflow,
    startJobNodeId: loop.workflow.startJobNodeId === previousId ? job.id : loop.workflow.startJobNodeId,
    jobNodes: loop.workflow.jobNodes.map((candidate) => candidate.id === previousId ? job : candidate),
    passEdges: loop.workflow.passEdges.map((edge) => "jobNodeId" in edge.target && edge.target.jobNodeId === previousId
      ? { ...edge, target: { jobNodeId: job.id } }
      : edge)
  }
});

export const replaceValidationNode = (
  loop: ProjectLoop,
  previousId: string,
  validation: ProjectValidationNode
): ProjectLoop => ({
  ...loop,
  workflow: {
    ...loop.workflow,
    jobNodes: loop.workflow.jobNodes.map((job) => job.validationNodeId === previousId
      ? { ...job, validationNodeId: validation.id }
      : job),
    validationNodes: loop.workflow.validationNodes.map((candidate) =>
      candidate.id === previousId ? validation : candidate),
    passEdges: loop.workflow.passEdges.map((edge) => edge.sourceValidationNodeId === previousId
      ? { ...edge, sourceValidationNodeId: validation.id }
      : edge),
    failEdges: loop.workflow.failEdges.map((edge) => edge.sourceValidationNodeId === previousId
      ? { ...edge, sourceValidationNodeId: validation.id }
      : edge)
  }
});

export const canRemoveJobPair = (loop: ProjectLoop, jobNodeId: string): boolean =>
  loop.workflow.startJobNodeId !== jobNodeId
  && !loop.workflow.passEdges.some((edge) => "jobNodeId" in edge.target && edge.target.jobNodeId === jobNodeId);

export const removeJobPair = (loop: ProjectLoop, jobNodeId: string): ProjectLoop => {
  if (!canRemoveJobPair(loop, jobNodeId)) return loop;
  const job = loop.workflow.jobNodes.find((candidate) => candidate.id === jobNodeId);
  if (!job) return loop;
  return {
    ...loop,
    workflow: {
      ...loop.workflow,
      jobNodes: loop.workflow.jobNodes.filter((candidate) => candidate.id !== jobNodeId),
      validationNodes: loop.workflow.validationNodes.filter((candidate) => candidate.id !== job.validationNodeId),
      passEdges: loop.workflow.passEdges.filter((edge) => edge.sourceValidationNodeId !== job.validationNodeId),
      failEdges: loop.workflow.failEdges.filter((edge) => edge.sourceValidationNodeId !== job.validationNodeId)
    }
  };
};

export const reorderJobNodes = (loop: ProjectLoop, fromIndex: number, toIndex: number): ProjectLoop => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0
    || fromIndex >= loop.workflow.jobNodes.length || toIndex >= loop.workflow.jobNodes.length) return loop;
  const jobNodes = [...loop.workflow.jobNodes];
  const [moved] = jobNodes.splice(fromIndex, 1);
  if (!moved) return loop;
  jobNodes.splice(toIndex, 0, moved);
  return { ...loop, workflow: { ...loop.workflow, jobNodes } };
};

export const updatePassEdgeTarget = (
  loop: ProjectLoop,
  sourceValidationNodeId: string,
  target: ProjectPassEdgeTarget
): ProjectLoop => {
  const existing = loop.workflow.passEdges.find((edge) => edge.sourceValidationNodeId === sourceValidationNodeId);
  if (existing) return {
    ...loop,
    workflow: {
      ...loop.workflow,
      passEdges: loop.workflow.passEdges.map((edge) => edge.id === existing.id ? { ...edge, target } : edge)
    }
  };

  return {
    ...loop,
    workflow: {
      ...loop.workflow,
      passEdges: [...loop.workflow.passEdges, {
        id: uniqueId(loop.workflow.passEdges.map((edge) => edge.id), `${loop.id}-${sourceValidationNodeId}-pass`),
        sourceValidationNodeId,
        target
      }]
    }
  };
};

export const replacePassEdge = (
  loop: ProjectLoop,
  previousId: string,
  passEdge: ProjectPassEdge
): ProjectLoop => ({
  ...loop,
  workflow: {
    ...loop.workflow,
    passEdges: loop.workflow.passEdges.map((edge) => edge.id === previousId ? passEdge : edge)
  }
});

export const replaceFailEdge = (
  loop: ProjectLoop,
  previousId: string,
  failEdge: ProjectFailEdge
): ProjectLoop => ({
  ...loop,
  workflow: {
    ...loop.workflow,
    failEdges: loop.workflow.failEdges.map((edge) => edge.id === previousId ? failEdge : edge)
  }
});

export const changeJobNodeType = (
  node: ProjectJobNode,
  type: ProjectJobNode["type"]
): ProjectJobNode => {
  if (node.type === type) return node;
  const identity = {
    id: node.id,
    description: node.description,
    validationNodeId: node.validationNodeId,
    maxRetries: node.maxRetries,
    nodeStyle: node.nodeStyle,
    nodeSize: node.nodeSize,
    task: node.task
  };
  if (type === "human") return { type, ...identity };
  const composition = isProjectProviderJobNode(node)
    ? {
        executionProfileId: node.executionProfileId,
        primaryInstructionId: node.primaryInstructionId,
        skillIds: node.skillIds
      }
    : { executionProfileId: "", primaryInstructionId: "", skillIds: [] };
  if (type === "scheduled") return { type, ...identity, ...composition, schedule: defaultOnceSchedule() };
  return { type, ...identity, ...composition };
};

export const changeValidationNodeType = (
  node: ProjectValidationNode,
  type: ProjectValidationNode["type"]
): ProjectValidationNode => {
  if (node.type === type) return node;
  const identity = {
    id: node.id,
    description: node.description,
    nodeStyle: node.nodeStyle,
    nodeSize: node.nodeSize,
    task: node.task
  };
  return type === "human"
    ? { type, ...identity }
    : { type, ...identity, executionProfileId: "", primaryInstructionId: "", skillIds: [] };
};

const uniqueId = (ids: readonly string[], base: string): string => {
  const existing = new Set(ids);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};
