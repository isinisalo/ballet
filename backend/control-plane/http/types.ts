import type { Request } from "express";
import type { ProjectLoop } from "../../../shared/domain/automation.js";
import type { PairingSession } from "../../../shared/domain/runtime.js";
import type { ControlPlaneService } from "../ControlPlaneService.js";

export interface ControlPlaneRouterOptions {
  service: ControlPlaneService;
  secureCookies?: boolean;
  resolveLoopSnapshot?: (loopId: string) => Promise<ProjectLoop | undefined> | ProjectLoop | undefined;
  installCommand?: (input: { request: Request; pairing: PairingSession }) => string | undefined;
  verificationUri?: (request: Request, pairing: PairingSession) => string;
}
