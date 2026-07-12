interface WaitingConsumer<T> {
  resolve: (value: IteratorResult<T>) => void;
  reject: (error: unknown) => void;
}

export class AsyncEventQueue<T> implements AsyncIterable<T> {
  private readonly buffered: T[] = [];
  private readonly waiting: WaitingConsumer<T>[] = [];
  private ended = false;
  private failure?: unknown;

  push(value: T): void {
    if (this.ended) return;
    const consumer = this.waiting.shift();
    if (consumer) consumer.resolve({ value, done: false });
    else this.buffered.push(value);
  }

  close(): void {
    if (this.ended) return;
    this.ended = true;
    this.drainWaiters();
  }

  fail(error: unknown): void {
    if (this.ended) return;
    this.failure = error;
    this.ended = true;
    this.drainWaiters();
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return { next: () => this.next() };
  }

  private next(): Promise<IteratorResult<T>> {
    const value = this.buffered.shift();
    if (value !== undefined) return Promise.resolve({ value, done: false });
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (this.ended) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  private drainWaiters(): void {
    const waiting = this.waiting.splice(0);
    for (const consumer of waiting) {
      if (this.failure !== undefined) consumer.reject(this.failure);
      else consumer.resolve({ value: undefined, done: true });
    }
  }
}
