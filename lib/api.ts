import { getAccessToken } from "./storage/auth";

/**
 * NestJS base URL: EXPO_PUBLIC_API_URL (no trailing slash).
 * Optional path prefix: EXPO_PUBLIC_API_PREFIX (e.g. `api` → /api/posts/feed).
 * Physical device → use your machine's LAN IP, not localhost.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

/** Optional global prefix, e.g. `api` → requests go to `/api/posts/feed` */
const API_PREFIX = (process.env.EXPO_PUBLIC_API_PREFIX ?? "").replace(
  /^\/+|\/+$/g,
  ""
);

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

function joinUrl(base: string, prefix: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!prefix) return `${base}${p}`;
  return `${base}/${prefix}${p}`;
}

function extractErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const raw = d.message;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw.map(String).join(", ");
  return "";
}

/** Routes that must not send a stored access token (avoid confusing proxies / future middleware). */
function isPublicAuthPath(path: string): boolean {
  const base = path.split("?")[0];
  return (
    base.endsWith("/auth/login") ||
    base.endsWith("/auth/signup") ||
    base.endsWith("/auth/forgot-password") ||
    base.endsWith("/auth/reset-password")
  );
}

/** Dev-only JWT tracing — never logs in production builds. */
const JWT_LOG = "[WatchCue JWT]";

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options;
  const method = (options.method ?? "GET").toUpperCase();

  if (!BASE_URL) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_URL. Copy .env.example to .env, set the URL to your API, then restart Expo."
    );
  }

  const token = getAccessToken();
  const attachToken = !!token && !isPublicAuthPath(path);
  const url = joinUrl(BASE_URL, API_PREFIX, path);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
    ...(attachToken ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (__DEV__) {
    console.log(`${JWT_LOG} → ${method} ${path}`);
    console.log(`${JWT_LOG} → full URL: ${url}`);
    if (attachToken) {
      console.log(`${JWT_LOG} → outgoing Authorization Bearer (full JWT):\n${token}`);
    } else if (isPublicAuthPath(path)) {
      console.log(`${JWT_LOG} → outgoing: no Authorization (public auth route)`);
    } else {
      console.log(`${JWT_LOG} → outgoing: no stored token (header omitted)`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const hint =
      e instanceof Error && e.message === "Network request failed"
        ? " Check EXPO_PUBLIC_API_URL (physical devices need your Mac’s LAN IP; Android emulator often needs http://10.0.2.2:3000)."
        : "";
    const devUrl = __DEV__ ? ` Requested: ${url}` : "";
    throw new Error(
      `${e instanceof Error ? e.message : "Network error"}.${hint}${devUrl}`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (__DEV__ && response.ok) {
    const access = (data as { accessToken?: unknown }).accessToken;
    if (typeof access === "string" && access.length > 0) {
      console.log(
        `${JWT_LOG} ← response accessToken from backend (full JWT):\n${access}`
      );
    }
  }

  if (!response.ok) {
    if (__DEV__ && response.status === 401) {
      console.warn(
        `${JWT_LOG} ← 401 Unauthorized for ${method} ${path}. Body:`,
        data
      );
      console.warn(
        `${JWT_LOG} ← token that was sent on this request:`,
        attachToken ? token : "(not attached for this path)"
      );
    }
    const bodyMsg = extractErrorMessage(data);
    const combined =
      bodyMsg ||
      (typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "");
    const detail = combined || response.statusText || "Something went wrong";
    const staleJwtHint =
      !isPublicAuthPath(path) &&
      (response.status === 401 ||
        response.status === 403 ||
        response.status === 402)
        ? " Sign out and sign in again, or clear the app session. If this persists, the API may be using a different JWT_SECRET than when your token was issued."
        : "";
    const login401Hint =
      isPublicAuthPath(path) &&
      response.status === 401 &&
      path.includes("login")
        ? " For login, this is usually a wrong email/password, or the account exists on another database. Try signing up again or run the API seed script."
        : "";
    throw new Error(
      `HTTP ${response.status}: ${detail}.${staleJwtHint}${login401Hint}`
    );
  }

  return data as T;
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  get: <T>(path: string) =>
    request<T>(path, { method: "GET" }),
};
