import type { ApiErrorBody } from "./types";

export type ApiErrorKind = "network" | "timeout" | "not_found" | "validation" | "server" | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly path: string;
  /** Field-level messages from a 422 response, keyed by the last `loc` segment. */
  readonly fieldErrors: Record<string, string>;

  constructor(opts: {
    kind: ApiErrorKind;
    message: string;
    path: string;
    status?: number | null;
    fieldErrors?: Record<string, string>;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.path = opts.path;
    this.fieldErrors = opts.fieldErrors ?? {};
  }
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "network":
        return "Could not reach the MeenMitra backend. Check that it is running and that NEXT_PUBLIC_API_BASE_URL is correct.";
      case "timeout":
        return "The backend took too long to respond.";
      case "not_found":
        return err.message || "Not found.";
      default:
        return err.message;
    }
  }
  if (err instanceof Error) return err.message;
  return "Unexpected error.";
}

export async function errorFromResponse(res: Response, path: string): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as Partial<ApiErrorBody>;
  } catch {
    body = null;
  }

  const fieldErrors: Record<string, string> = {};
  let message = `Request failed (${res.status} ${res.statusText}).`;

  if (body && typeof body.detail === "string") {
    message = body.detail;
  } else if (body && Array.isArray(body.detail)) {
    for (const item of body.detail) {
      const key = String(item.loc[item.loc.length - 1] ?? "request");
      fieldErrors[key] = item.msg;
    }
    message = "Some fields are invalid. Please correct them and try again.";
  }

  const kind: ApiErrorKind =
    res.status === 404
      ? "not_found"
      : res.status === 422 || res.status === 400
        ? "validation"
        : res.status >= 500
          ? "server"
          : "http";

  // FastAPI answers unknown routes with the generic {"detail": "Not Found"}; treat that as a missing endpoint.
  if (kind === "not_found" && !(body && typeof body.detail === "string" && body.detail !== "Not Found")) {
    message = `The backend does not provide ${path} (404). This endpoint may not be implemented yet.`;
  }

  return new ApiError({ kind, message, path, status: res.status, fieldErrors });
}
