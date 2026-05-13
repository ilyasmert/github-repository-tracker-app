import type { ApiErrorBody } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. an upstream proxy 502 returning HTML). Leave body
      // null so we fall through to the generic error path below.
    }
  }

  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(
      err?.error?.code ?? "UNKNOWN",
      err?.error?.message ?? res.statusText ?? "Request failed",
      res.status,
    );
  }

  return body as T;
}