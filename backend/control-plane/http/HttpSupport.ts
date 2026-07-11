import type { ErrorRequestHandler, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { parseUnknown, HttpValidationError } from "../../http/validation/httpValidation.js";
import type { ControlPlaneService } from "../ControlPlaneService.js";
import type { DaemonIdentity } from "../PairingStore.js";
import {
  ControlPlaneConflictError,
  ControlPlaneForbiddenError,
  ControlPlaneGoneError,
  ControlPlaneNotFoundError,
  ControlPlanePreflightError,
  ControlPlaneRateLimitError,
  ControlPlaneRuntimeConfigurationError,
  ControlPlaneUnauthorizedError,
  ControlPlaneValidationError
} from "../errors.js";

export const asyncHandler = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => { void handler(req, res).catch(next); };

export const parseBody = <T>(schema: ZodType<T>, req: Request): T => parseUnknown(schema, req.body ?? {});
export const parseParams = <T>(schema: ZodType<T>, req: Request): T => parseUnknown(schema, req.params);
export const parseQuery = <T>(schema: ZodType<T>, req: Request): T => parseUnknown(schema, req.query);

export const readCookie = (req: Request, name: string): string | undefined => {
  const cookies = Object.fromEntries((req.headers.cookie ?? "").split(";").flatMap((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [] : [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
  }));
  return cookies[name];
};

export const adminAuth = (service: ControlPlaneService, csrf: boolean): RequestHandler => (req, res, next) => {
  try {
    const session = readCookie(req, "ballet_session");
    if (!session) throw new ControlPlaneUnauthorizedError();
    const csrfHeader = csrf ? req.header("x-csrf-token") : undefined;
    if (csrf && (!csrfHeader || csrfHeader !== readCookie(req, "ballet_csrf"))) throw new ControlPlaneForbiddenError("Invalid CSRF token.");
    res.locals.admin = service.authenticateAdmin(session, csrfHeader);
    next();
  } catch (error) {
    next(error);
  }
};

export const daemonAuth = (service: ControlPlaneService): RequestHandler => (req, res, next) => {
  try {
    const match = req.header("authorization")?.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) throw new ControlPlaneUnauthorizedError("Missing daemon bearer token.");
    res.locals.daemon = service.authenticateDaemon(match[1]) satisfies DaemonIdentity;
    next();
  } catch (error) {
    next(error);
  }
};

export const daemonIdentity = (res: Response): DaemonIdentity => res.locals.daemon as DaemonIdentity;

export const setSessionCookies = (res: Response, session: { sessionToken: string; csrfToken: string; expiresAt: string }, secure: boolean): void => {
  const maxAge = Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000));
  const securePart = secure ? "; Secure" : "";
  res.append("Set-Cookie", `ballet_session=${encodeURIComponent(session.sessionToken)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${securePart}`);
  res.append("Set-Cookie", `ballet_csrf=${encodeURIComponent(session.csrfToken)}; Path=/api; SameSite=Strict; Max-Age=${maxAge}${securePart}`);
};

export const clearSessionCookies = (res: Response, secure: boolean): void => {
  const securePart = secure ? "; Secure" : "";
  res.append("Set-Cookie", `ballet_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${securePart}`);
  res.append("Set-Cookie", `ballet_csrf=; Path=/api; SameSite=Strict; Max-Age=0${securePart}`);
};

export const controlPlaneErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof HttpValidationError) { res.status(error.status).json({ error: error.message, issues: error.issues }); return; }
  if (error instanceof ControlPlanePreflightError) { res.status(409).json({ error: error.message, issues: error.issues }); return; }
  if (error instanceof ControlPlaneRuntimeConfigurationError) { res.status(409).json({ error: error.message, issues: error.issues }); return; }
  if (error instanceof ControlPlaneValidationError) { res.status(400).json({ error: error.message }); return; }
  if (error instanceof ControlPlaneUnauthorizedError) { res.status(401).json({ error: error.message }); return; }
  if (error instanceof ControlPlaneForbiddenError) { res.status(403).json({ error: error.message }); return; }
  if (error instanceof ControlPlaneNotFoundError) { res.status(404).json({ error: error.message }); return; }
  if (error instanceof ControlPlaneGoneError) { res.status(410).json({ error: error.message }); return; }
  if (error instanceof ControlPlaneRateLimitError) { res.status(429).json({ error: error.message }); return; }
  if (error instanceof ControlPlaneConflictError) { res.status(409).json({ error: error.message }); return; }
  next(error);
};

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  check(key: string, now = Date.now()): void {
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) { this.windows.set(key, { count: 1, resetAt: now + this.windowMs }); return; }
    if (current.count >= this.limit) throw new ControlPlaneRateLimitError("Too many pairing attempts. Try again later.");
    current.count += 1;
  }
}
