import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

if (typeof window !== "undefined") {
  class TestEventSource extends EventTarget {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(public readonly url: string) {
      super();
      window.setTimeout(() => this.onopen?.(), 0);
    }

    close() {
      // Test double; no persistent connection is opened.
    }
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });

  Object.defineProperty(window, "EventSource", {
    writable: true,
    value: TestEventSource
  });

  Object.defineProperty(globalThis, "EventSource", {
    writable: true,
    value: TestEventSource
  });

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class {
      observe() {
        // Test double.
      }
      unobserve() {
        // Test double.
      }
      disconnect() {
        // Test double.
      }
    }
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
