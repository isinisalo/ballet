import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

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

  class TestResizeObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(target: Element) {
      const bounds = target.getBoundingClientRect();
      const width = bounds.width || 1024;
      const height = bounds.height || 768;
      const contentRect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({})
      } as DOMRectReadOnly;
      const boxSize = [{ inlineSize: width, blockSize: height }] as ResizeObserverSize[];

      this.callback([{
        target,
        contentRect,
        borderBoxSize: boxSize,
        contentBoxSize: boxSize,
        devicePixelContentBoxSize: boxSize
      } as ResizeObserverEntry], this);
    }

    unobserve() {
      // Test double.
    }

    disconnect() {
      // Test double.
    }
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: TestResizeObserver
  });

  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: TestResizeObserver
  });

  if (typeof window.DOMMatrixReadOnly !== "function") {
    class TestDOMMatrixReadOnly {
      readonly m22 = 1;
    }

    Object.defineProperty(window, "DOMMatrixReadOnly", {
      writable: true,
      value: TestDOMMatrixReadOnly
    });
  }

  if (!window.HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
      writable: true,
      value: () => false
    });
  }

  if (!window.HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
      writable: true,
      value: () => undefined
    });
  }

  if (!window.HTMLElement.prototype.releasePointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
      writable: true,
      value: () => undefined
    });
  }

  if (!window.HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      writable: true,
      value: () => undefined
    });
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
