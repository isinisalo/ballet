export interface CopilotSdkModule {
  CopilotClient: new (options?: Record<string, unknown>) => CopilotClientLike;
  RuntimeConnection: {
    forStdio(options: { path: string; args?: readonly string[] }): unknown;
  };
}

export interface CopilotClientLike {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean; statusMessage?: string }>;
  listModels(): Promise<unknown[]>;
  createSession(config: Record<string, unknown>): Promise<CopilotSessionLike>;
}

export interface CopilotSessionLike {
  rpc: {
    options: {
      update(options: Record<string, unknown>): Promise<unknown>;
    };
  };
  on(handler: (event: CopilotSessionEvent) => void): () => void;
  sendAndWait(options: { prompt: string }, timeout?: number): Promise<unknown>;
  abort(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface CopilotSessionEvent {
  type: string;
  data?: Record<string, unknown>;
}

export type CopilotSdkLoader = () => Promise<CopilotSdkModule>;

export const loadCopilotSdk: CopilotSdkLoader = async () => {
  try {
    return await import("@github/copilot-sdk") as unknown as CopilotSdkModule;
  } catch (error) {
    throw new Error(`@github/copilot-sdk is required for the Copilot runtime: ${error instanceof Error ? error.message : String(error)}`);
  }
};
