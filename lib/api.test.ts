/**
 * Unit tests for the pure helpers in lib/api.ts.
 *
 * BASE_URL inside api.ts is captured at module load from
 * process.env.EXPO_PUBLIC_API_URL. We set it before importing here so
 * mediaUrl/isOwnServerUrl have a deterministic origin to compare against.
 * Cases that require a different (or absent) BASE_URL use jest.isolateModules.
 */
process.env.EXPO_PUBLIC_API_URL = "http://api.test";

import {
  extractErrorMessage,
  isOwnServerUrl,
  isPublicAuthPath,
  joinUrl,
  mediaUrl,
} from "./api";

// ── joinUrl ──────────────────────────────────────────────────────────────────

describe("joinUrl", () => {
  it("joins base + path with a leading slash", () => {
    expect(joinUrl("http://api.test", "", "/posts/feed")).toBe(
      "http://api.test/posts/feed",
    );
  });

  it("adds a leading slash when path is missing one", () => {
    expect(joinUrl("http://api.test", "", "posts/feed")).toBe(
      "http://api.test/posts/feed",
    );
  });

  it("inserts the prefix between base and path", () => {
    expect(joinUrl("http://api.test", "api", "/posts/feed")).toBe(
      "http://api.test/api/posts/feed",
    );
  });

  it("handles prefix with a path missing leading slash", () => {
    expect(joinUrl("http://api.test", "api", "posts/feed")).toBe(
      "http://api.test/api/posts/feed",
    );
  });

  it("treats an empty prefix as no prefix", () => {
    expect(joinUrl("http://api.test", "", "/x")).toBe("http://api.test/x");
  });
});

// ── extractErrorMessage ──────────────────────────────────────────────────────

describe("extractErrorMessage", () => {
  it("returns empty string for null/undefined/non-objects", () => {
    expect(extractErrorMessage(null)).toBe("");
    expect(extractErrorMessage(undefined)).toBe("");
    expect(extractErrorMessage("oops")).toBe("");
    expect(extractErrorMessage(42)).toBe("");
  });

  it("returns string `message` field as-is", () => {
    expect(extractErrorMessage({ message: "Email already in use" })).toBe(
      "Email already in use",
    );
  });

  it("joins array `message` (Nest validation pipes return arrays)", () => {
    expect(
      extractErrorMessage({ message: ["email must be valid", "password too short"] }),
    ).toBe("email must be valid, password too short");
  });

  it("ignores empty string message", () => {
    expect(extractErrorMessage({ message: "" })).toBe("");
  });

  it("ignores empty array message", () => {
    expect(extractErrorMessage({ message: [] })).toBe("");
  });

  it("ignores non-string non-array message values", () => {
    expect(extractErrorMessage({ message: 123 })).toBe("");
    expect(extractErrorMessage({ message: { nested: "x" } })).toBe("");
  });

  it("returns empty string when message field is absent", () => {
    expect(extractErrorMessage({ error: "Bad Request" })).toBe("");
  });
});

// ── isPublicAuthPath ─────────────────────────────────────────────────────────

describe("isPublicAuthPath", () => {
  it.each([
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/reset-password",
  ])("returns true for %s", (path) => {
    expect(isPublicAuthPath(path)).toBe(true);
  });

  it("strips query string before matching", () => {
    expect(isPublicAuthPath("/auth/login?redirect=/feed")).toBe(true);
    expect(isPublicAuthPath("/auth/reset-password?token=abc")).toBe(true);
  });

  it("returns false for protected routes", () => {
    expect(isPublicAuthPath("/posts/feed")).toBe(false);
    expect(isPublicAuthPath("/users/me")).toBe(false);
    expect(isPublicAuthPath("/hubs/123")).toBe(false);
  });

  it("does not match partial endings", () => {
    // `/login` alone is not an auth path — must be `/auth/login`.
    expect(isPublicAuthPath("/login")).toBe(false);
  });
});

// ── mediaUrl ─────────────────────────────────────────────────────────────────

describe("mediaUrl (BASE_URL = http://api.test)", () => {
  it("returns null for empty / nullish input", () => {
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl(undefined)).toBeNull();
    expect(mediaUrl("")).toBeNull();
  });

  it("returns absolute http(s) URLs unchanged", () => {
    expect(mediaUrl("https://image.tmdb.org/p/x.jpg")).toBe(
      "https://image.tmdb.org/p/x.jpg",
    );
    expect(mediaUrl("http://other.host/y.png")).toBe("http://other.host/y.png");
  });

  it("returns data: and file: URIs unchanged", () => {
    expect(mediaUrl("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(mediaUrl("file:///tmp/x.mp4")).toBe("file:///tmp/x.mp4");
  });

  it("joins server-relative paths to BASE_URL", () => {
    expect(mediaUrl("/uploads/posts/x.mp4")).toBe(
      "http://api.test/uploads/posts/x.mp4",
    );
  });

  it("adds a slash when relative path is missing one", () => {
    expect(mediaUrl("uploads/posts/x.mp4")).toBe(
      "http://api.test/uploads/posts/x.mp4",
    );
  });
});

describe("mediaUrl with no BASE_URL", () => {
  it("returns the input unchanged when EXPO_PUBLIC_API_URL is unset", () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_API_URL;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { mediaUrl: m } = require("./api") as typeof import("./api");
      expect(m("/uploads/x.jpg")).toBe("/uploads/x.jpg");
      expect(m("uploads/x.jpg")).toBe("uploads/x.jpg");
    });
    // Restore for any later tests in this file.
    process.env.EXPO_PUBLIC_API_URL = "http://api.test";
  });
});

// ── isOwnServerUrl ───────────────────────────────────────────────────────────

describe("isOwnServerUrl (BASE_URL = http://api.test)", () => {
  it("returns false for empty / nullish input", () => {
    expect(isOwnServerUrl(null)).toBe(false);
    expect(isOwnServerUrl(undefined)).toBe(false);
    expect(isOwnServerUrl("")).toBe(false);
  });

  it("returns false for data: and file: URIs", () => {
    expect(isOwnServerUrl("data:video/mp4;base64,AAAA")).toBe(false);
    expect(isOwnServerUrl("file:///tmp/clip.mp4")).toBe(false);
  });

  it("treats relative paths as own-server", () => {
    expect(isOwnServerUrl("/uploads/posts/x.mp4")).toBe(true);
    expect(isOwnServerUrl("uploads/posts/x.mp4")).toBe(true);
  });

  it("matches absolute URLs whose origin equals BASE_URL", () => {
    expect(isOwnServerUrl("http://api.test/uploads/x.mp4")).toBe(true);
  });

  it("matches case-insensitively against BASE_URL", () => {
    expect(isOwnServerUrl("HTTP://API.TEST/uploads/x.mp4")).toBe(true);
  });

  it("matches absolute URLs on a different host whose path starts with /uploads/ (LAN-IP dev case)", () => {
    expect(isOwnServerUrl("http://192.168.1.10:3000/uploads/x.mp4")).toBe(true);
    expect(isOwnServerUrl("http://localhost:3000/uploads/x.mp4")).toBe(true);
  });

  it("returns false for absolute URLs on other hosts that are NOT under /uploads/", () => {
    expect(isOwnServerUrl("https://image.tmdb.org/p/poster.jpg")).toBe(false);
    expect(isOwnServerUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
    expect(isOwnServerUrl("http://other.host/clip.mp4")).toBe(false);
  });
});
