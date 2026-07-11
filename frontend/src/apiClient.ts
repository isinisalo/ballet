import { toErrorMessage } from "@/lib/errors";

type ErrorResponseBody = {
  error?: string;
  issues?: Array<{ path?: string; message?: string }>;
};

let csrfToken = "";

export const setCsrfToken = (value?: string) => {
  csrfToken = value ?? "";
};

const parseJsonBody = async <T,>(response: Response): Promise<T | undefined> => {
  const text = await response.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Request failed with ${response.status}: ${toErrorMessage(error, "Invalid response body.")}`);
  }
};

export const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(url, { credentials: "same-origin", ...init, headers });
  if (!response.ok) {
    const body = (await parseJsonBody<ErrorResponseBody>(response)) ?? {};
    const issueMessage = body.issues
      ?.map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; ");
    throw new Error(issueMessage
      ? `${body.error ?? `Request failed with ${response.status}`}: ${issueMessage}`
      : body.error ?? `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await parseJsonBody<T>(response)) as T;
};
