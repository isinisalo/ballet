export interface ExecutionQueueBoundary {
  enqueue(taskId: string): void;
  next(): string | undefined;
  has(taskId: string): boolean;
}

export class DeterministicExecutionQueue implements ExecutionQueueBoundary {
  private readonly items: string[] = [];
  private readonly indexed = new Set<string>();

  enqueue(taskId: string): void {
    if (this.indexed.has(taskId)) return;
    this.indexed.add(taskId);
    this.items.push(taskId);
  }

  next(): string | undefined {
    const taskId = this.items.shift();
    if (taskId) this.indexed.delete(taskId);
    return taskId;
  }

  has(taskId: string): boolean { return this.indexed.has(taskId); }
}
