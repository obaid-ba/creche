import { AxiosError } from "axios";

import type { ApiErrorBody } from "@/types/api";

/**
 * A normalised API error.
 *
 * The backend guarantees one envelope shape (docs/api.md 3), so this is the
 * only place in the frontend that has to know about error wire format.
 * Everything downstream reads `message` and `fieldErrors`.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string | null;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    fieldErrors?: Record<string, string[]>;
    requestId?: string | null;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors ?? {};
    this.requestId = params.requestId ?? null;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isPermissionError(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400;
  }
}

/** French fallbacks for failures that never reach the API. */
const NETWORK_MESSAGE =
  "network.offline";
/** Translation keys, resolved where they are displayed: this module is
 *  imported by the axios client, which has no React context. */
const TIMEOUT_MESSAGE = "network.timeout";
const UNKNOWN_MESSAGE = "Une erreur inattendue est survenue.";

export function normaliseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ApiError({
        code: "timeout",
        message: TIMEOUT_MESSAGE,
        status: 0,
      });
    }

    if (!error.response) {
      return new ApiError({
        code: "network_error",
        message: NETWORK_MESSAGE,
        status: 0,
      });
    }

    const body = error.response.data as Partial<ApiErrorBody> | undefined;
    if (body?.error) {
      return new ApiError({
        code: body.error.code,
        message: body.error.message,
        status: error.response.status,
        fieldErrors: body.error.details ?? {},
        requestId: body.error.request_id ?? null,
      });
    }

    return new ApiError({
      code: "http_error",
      message: UNKNOWN_MESSAGE,
      status: error.response.status,
    });
  }

  return new ApiError({ code: "unknown", message: UNKNOWN_MESSAGE, status: 0 });
}
