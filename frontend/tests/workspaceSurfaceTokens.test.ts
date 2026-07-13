import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "frontend/src/styles.css"), "utf8");
const rootTokens = styles.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

const tokenValue = (name: string) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return rootTokens.match(new RegExp(`^\\s*${escapedName}:\\s*([^;]+);`, "m"))?.[1].trim();
};

describe("workspace surface tokens", () => {
  it("uses a near-black workspace hierarchy without changing sidebar elevation", () => {
    expect(tokenValue("--background")).toBe("var(--ballet-surface-lowest)");
    expect(tokenValue("--card")).toBe("var(--ballet-surface)");
    expect(tokenValue("--panel")).toBe("var(--ballet-surface)");
    expect(tokenValue("--panel-header")).toBe("var(--ballet-surface-low)");
    expect(tokenValue("--panel-section")).toBe("var(--ballet-surface-low)");
    expect(tokenValue("--sidebar")).toBe("var(--ballet-surface-low)");
  });

  it("keeps elevated overlays and sidebar hover states distinct", () => {
    expect(tokenValue("--popover")).toBe("var(--ballet-surface-container)");
    expect(tokenValue("--sidebar-hover")).toBe("var(--ballet-surface-high)");
  });
});
