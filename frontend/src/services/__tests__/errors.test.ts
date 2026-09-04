import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError, normaliseError } from "../errors";

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError("failed");
  error.response = {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe("normaliseError", () => {
  it("unwraps the backend error envelope", () => {
    const result = normaliseError(
      axiosErrorWith(400, {
        error: {
          code: "validation_error",
          message: "Les données envoyées sont invalides.",
          details: { date_of_birth: ["Date invalide."] },
          request_id: "req-1",
        },
      }),
    );

    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe("validation_error");
    expect(result.message).toBe("Les données envoyées sont invalides.");
    expect(result.fieldErrors["date_of_birth"]).toEqual(["Date invalide."]);
    expect(result.requestId).toBe("req-1");
    expect(result.isValidationError).toBe(true);
  });

  it("reports a network failure in French when there is no response", () => {
    const result = normaliseError(new AxiosError("Network Error"));

    expect(result.code).toBe("network_error");
    expect(result.message).toMatch(/connexion/i);
    expect(result.status).toBe(0);
  });

  it("distinguishes a timeout from a generic network failure", () => {
    const error = new AxiosError("timeout");
    error.code = "ECONNABORTED";

    expect(normaliseError(error).code).toBe("timeout");
  });

  it("falls back gracefully when the body is not an envelope", () => {
    const result = normaliseError(axiosErrorWith(500, "<html>oops</html>"));

    expect(result.code).toBe("http_error");
    expect(result.status).toBe(500);
    expect(result.message).toMatch(/inattendue/i);
  });

  it("classifies auth, permission and not-found errors", () => {
    expect(normaliseError(axiosErrorWith(401, {})).isAuthError).toBe(true);
    expect(normaliseError(axiosErrorWith(403, {})).isPermissionError).toBe(true);
    expect(normaliseError(axiosErrorWith(404, {})).isNotFound).toBe(true);
  });

  it("passes an existing ApiError through unchanged", () => {
    const original = new ApiError({ code: "x", message: "y", status: 418 });
    expect(normaliseError(original)).toBe(original);
  });

  it("handles values that are not errors at all", () => {
    expect(normaliseError("boom").code).toBe("unknown");
  });
});
