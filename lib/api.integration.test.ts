/**
 * Integration tests for the api.request() pipeline.
 *
 * Wires together:
 *   - lib/api.ts  (URL builder, header construction, error parsing)
 *   - lib/storage/auth.ts  → __mocks__/react-native-mmkv.ts  (real auth state
 *     round-trips through the in-memory MMKV)
 * Only `fetch` is mocked, so we cover token attachment, body serialisation,
 * and error-message synthesis as a single flow per test.
 */
process.env.EXPO_PUBLIC_API_URL = "http://api.test";
delete process.env.EXPO_PUBLIC_API_PREFIX;

import { api } from "./api";
import { clearAuthSession, setAccessToken } from "./storage/auth";

// ── Fetch mock plumbing ──────────────────────────────────────────────────────

const fetchMock = jest.fn();
beforeAll(() => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
});
beforeEach(() => {
  fetchMock.mockReset();
  clearAuthSession();
});

interface JsonResponseInit {
  status?: number;
  statusText?: string;
  body?: unknown;
}

/** Minimal Response stand-in matching what api.ts reads. */
function jsonResponse({ status = 200, statusText = "OK", body = {} }: JsonResponseInit = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  };
}

function lastCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  return { url: call[0] as string, init: call[1] as RequestInit };
}

function headers(init: RequestInit): Record<string, string> {
  return (init.headers ?? {}) as Record<string, string>;
}

// ── URL + method ─────────────────────────────────────────────────────────────

describe("api.request — URL and method", () => {
  it("GETs the joined URL with no prefix", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: { ok: true } }));
    await api.get("/posts/feed?limit=10");
    const { url, init } = lastCall();
    expect(url).toBe("http://api.test/posts/feed?limit=10");
    expect(init.method).toBe("GET");
  });

  it("POSTs with method propagated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.post("/posts/123/like", {});
    expect(lastCall().init.method).toBe("POST");
  });

  it("DELETEs with method propagated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.delete("/posts/123");
    expect(lastCall().init.method).toBe("DELETE");
  });
});

// ── Auth header attachment ───────────────────────────────────────────────────

describe("api.request — Authorization header", () => {
  it("attaches Bearer token on protected GET when token is stored", async () => {
    setAccessToken("tok-abc");
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.get("/users/me");
    expect(headers(lastCall().init).Authorization).toBe("Bearer tok-abc");
  });

  it("omits Authorization when no token is stored", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.get("/posts/feed");
    expect(headers(lastCall().init).Authorization).toBeUndefined();
  });

  it.each([
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/reset-password",
  ])("does NOT attach Authorization on %s even with a stored token", async (path) => {
    setAccessToken("tok-abc");
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.post(path, {});
    expect(headers(lastCall().init).Authorization).toBeUndefined();
  });
});

// ── Body serialisation ───────────────────────────────────────────────────────

describe("api.request — body serialisation", () => {
  it("JSON-stringifies object bodies and sets Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.post("/posts", { title: "hi", body: "world" });
    const { init } = lastCall();
    expect(headers(init)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ title: "hi", body: "world" }));
  });

  it("does NOT set Content-Type for FormData (fetch sets multipart boundary)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    const fd = new FormData();
    fd.append("file", "blob");
    await api.post("/posts/upload", fd);
    const { init } = lastCall();
    expect(headers(init)["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(fd);
  });

  it("sends GET with no body even when Content-Type is set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ body: {} }));
    await api.get("/posts/feed");
    expect(lastCall().init.body).toBeUndefined();
  });
});

// ── Successful response parsing ──────────────────────────────────────────────

describe("api.request — successful responses", () => {
  it("returns parsed JSON typed as T", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ body: { posts: [{ id: "1" }], hasNextPage: false } }),
    );
    const data = await api.get<{ posts: { id: string }[]; hasNextPage: boolean }>(
      "/posts/feed",
    );
    expect(data.posts).toEqual([{ id: "1" }]);
    expect(data.hasNextPage).toBe(false);
  });
});

// ── Error response handling ──────────────────────────────────────────────────

describe("api.request — error responses", () => {
  it("includes HTTP status and string `message` in the thrown error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 400, statusText: "Bad Request", body: { message: "Invalid email" } }),
    );
    await expect(api.post("/posts", {})).rejects.toThrow(/HTTP 400.*Invalid email/);
  });

  it("joins array `message` (Nest validation pipes)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 400,
        body: { message: ["email must be valid", "password too short"] },
      }),
    );
    await expect(api.post("/auth/signup", {})).rejects.toThrow(
      /email must be valid, password too short/,
    );
  });

  it("falls back to top-level `error` string when `message` absent", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 500, body: { error: "boom" } }),
    );
    await expect(api.get("/posts/feed")).rejects.toThrow(/boom/);
  });

  it("falls back to statusText when no body message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 502, statusText: "Bad Gateway", body: {} }),
    );
    await expect(api.get("/posts/feed")).rejects.toThrow(/Bad Gateway/);
  });

  it("appends stale-JWT hint on 401 for protected routes", async () => {
    setAccessToken("tok-stale");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 401, body: { message: "Unauthorized" } }),
    );
    await expect(api.get("/users/me")).rejects.toThrow(/Sign out and sign in again/);
  });

  it("appends login-specific hint on 401 for /auth/login", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 401, body: { message: "Bad credentials" } }),
    );
    await expect(api.post("/auth/login", { email: "x", password: "y" })).rejects.toThrow(
      /wrong email\/password/,
    );
  });

  it("does NOT append stale-JWT hint on public auth routes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 401, body: { message: "Bad credentials" } }),
    );
    await expect(api.post("/auth/login", {})).rejects.not.toThrow(
      /Sign out and sign in again/,
    );
  });
});

// ── Network failures ─────────────────────────────────────────────────────────

describe("api.request — network failure", () => {
  it("wraps a thrown fetch error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    await expect(api.get("/posts/feed")).rejects.toThrow(/Network request failed/);
  });

  it("adds the LAN-IP hint when fetch reports `Network request failed`", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    await expect(api.get("/posts/feed")).rejects.toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });
});

// ── Missing BASE_URL guard ───────────────────────────────────────────────────

describe("api.request — missing BASE_URL", () => {
  it("throws a helpful error when EXPO_PUBLIC_API_URL is unset", async () => {
    await jest.isolateModulesAsync(async () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      const mod = (await import("./api")) as typeof import("./api");
      await expect(mod.api.get("/posts/feed")).rejects.toThrow(
        /Missing EXPO_PUBLIC_API_URL/,
      );
    });
    process.env.EXPO_PUBLIC_API_URL = "http://api.test";
  });
});
