import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LEGACY_AGENT_ROOTS_REMEDIATION, LocalSettingsRepository } from "./LocalSettingsRepository.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const repository = async (): Promise<LocalSettingsRepository> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-local-settings-"));
  roots.push(root);
  return new LocalSettingsRepository(path.join(root, "settings.json"));
};

describe("local settings repository", () => {
  it("uses only global normalized read-only roots", async () => {
    const settings = await repository();
    await settings.write({
      version: 1,
      codexCommand: "/opt/codex",
      readOnlyRoots: ["/tmp/reference/..", "/tmp"]
    });

    await expect(settings.readOnlyRootsForRun()).resolves.toEqual(["/tmp"]);
    await expect(settings.load()).resolves.toEqual({
      version: 1,
      codexCommand: "/opt/codex",
      readOnlyRoots: ["/tmp"]
    });
  });

  it.each([{}, null, { profile: ["/tmp/reference"] }])(
    "fails closed on legacy agentReadOnlyRoots key presence (%j)",
    async (legacyValue) => {
      const settings = await repository();
      const source = `${JSON.stringify({
        version: 1,
        readOnlyRoots: ["/tmp/global"],
        agentReadOnlyRoots: legacyValue
      }, null, 2)}\n`;
      await writeFile(settings.filename, source, "utf8");

      await expect(settings.inspect()).resolves.toMatchObject({
        settings: { version: 1, readOnlyRoots: ["/tmp/global"] },
        legacyAgentReadOnlyRoots: true
      });
      await expect(settings.readOnlyRootsForRun()).rejects.toThrow(LEGACY_AGENT_ROOTS_REMEDIATION);
      await expect(settings.write({ version: 1, readOnlyRoots: ["/tmp/global"] }))
        .rejects.toThrow(LEGACY_AGENT_ROOTS_REMEDIATION);
      expect(await readFile(settings.filename, "utf8")).toBe(source);
    }
  );
});
