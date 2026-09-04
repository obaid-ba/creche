import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { normaliseError } from "./errors";
import { clearAccessToken, getAccessToken, setAccessToken } from "./tokenStore";

const BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  // Required so the browser sends the httpOnly refresh cookie.
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // File uploads must not inherit the JSON default: the browser has to
  // set multipart/form-data itself so it can append the boundary.
  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

/** Endpoints that must never trigger a refresh-and-retry cycle. */
const NO_RETRY_PATHS = ["/auth/login/", "/auth/refresh/", "/auth/logout/"];

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

/**
 * Single-flight refresh.
 *
 * Several requests can 401 at once when a token expires. Without this,
 * each would fire its own refresh, and because refresh tokens rotate
 * (docs/authentication.md 2) the later ones would present an
 * already-rotated token and be rejected — logging the user out mid-session.
 * So the first failure performs the refresh and the rest await it.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  refreshPromise ??= axios
    .post<{ access: string }>(
      `${BASE_URL}/auth/refresh/`,
      {},
      { withCredentials: true },
    )
    .then((response) => {
      const token = response.data.access;
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

let onSessionExpired: (() => void) | null = null;

/** Let the auth layer react to an unrecoverable session loss. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? "";

    const isRetriable =
      status === 401 &&
      config !== undefined &&
      !config._retried &&
      !NO_RETRY_PATHS.some((path) => url.includes(path));

    if (isRetriable) {
      config._retried = true;
      try {
        await refreshAccessToken();
        return await apiClient.request(config);
      } catch {
        clearAccessToken();
        onSessionExpired?.();
        return await Promise.reject(normaliseError(error));
      }
    }

    return Promise.reject(normaliseError(error));
  },
);

export { refreshAccessToken };
