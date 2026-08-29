import { afterEach, describe, expect, test } from "vitest";
import { providerChildEnvironment } from "./processProbe.js";

describe("provider child environment", () => {
  const originalSecret = process.env.BALLET_TEST_SECRET;
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.BALLET_TEST_SECRET;
    else process.env.BALLET_TEST_SECRET = originalSecret;
  });

  test("passes only the explicit runtime allowlist and never ambient secrets", () => {
    process.env.BALLET_TEST_SECRET = "must-not-cross-provider-boundary";
    const environment = providerChildEnvironment({ BALLET_EXPLICIT_TEST: "allowed" });
    expect(environment.BALLET_TEST_SECRET).toBeUndefined();
    expect(environment.BALLET_EXPLICIT_TEST).toBe("allowed");
    expect(environment.PATH).toBe(process.env.PATH);
  });
});
