/**
 * Round-trip tests for lib/storage/auth.ts. Uses the in-memory
 * react-native-mmkv mock from __mocks__/, so the same code paths the app
 * runs in production are exercised end-to-end (just without native MMKV).
 */
import {
  clearAccessToken,
  clearAuthSession,
  clearStoredUser,
  getAccessToken,
  getStoredUser,
  isAuthenticated,
  setAccessToken,
  setStoredUser,
  type StoredUser,
} from "./auth";
import { storage } from "./mmkv";

const sampleUser: StoredUser = {
  id: "u-1",
  email: "user@example.com",
  username: "user1",
  name: "User One",
  bio: null,
  profilePictureUrl: null,
  genres: ["Sci-Fi", "Drama"],
  watchedMovieIds: [101, 202],
  createdAt: "2026-04-27T10:00:00.000Z",
};

beforeEach(() => {
  // Each test starts from a clean slate so order doesn't matter.
  clearAuthSession();
});

// ── Access token ─────────────────────────────────────────────────────────────

describe("access token round-trip", () => {
  it("returns null when nothing is stored", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("set then get returns the same token", () => {
    setAccessToken("jwt.header.payload.sig");
    expect(getAccessToken()).toBe("jwt.header.payload.sig");
  });

  it("clearAccessToken removes the value", () => {
    setAccessToken("tok");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it("setAccessToken overwrites a previous value", () => {
    setAccessToken("first");
    setAccessToken("second");
    expect(getAccessToken()).toBe("second");
  });
});

// ── Stored user ──────────────────────────────────────────────────────────────

describe("stored user round-trip", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("set then get preserves the full shape (JSON round-trip)", () => {
    setStoredUser(sampleUser);
    expect(getStoredUser()).toEqual(sampleUser);
  });

  it("clearStoredUser removes the value", () => {
    setStoredUser(sampleUser);
    clearStoredUser();
    expect(getStoredUser()).toBeNull();
  });

  it("returns null (not throw) when the stored JSON is corrupt", () => {
    // Simulate a write from an older app version or a corrupted entry
    // by going around setStoredUser and writing raw bytes.
    storage.set("auth.user", "{not valid json");
    expect(getStoredUser()).toBeNull();
  });

  it("preserves nullable fields (bio, profilePictureUrl)", () => {
    const u: StoredUser = {
      ...sampleUser,
      bio: "Hello world",
      profilePictureUrl: "/uploads/users/abc.jpg",
    };
    setStoredUser(u);
    expect(getStoredUser()).toEqual(u);
  });
});

// ── Session helpers ──────────────────────────────────────────────────────────

describe("session helpers", () => {
  it("isAuthenticated reflects the presence of a token", () => {
    expect(isAuthenticated()).toBe(false);
    setAccessToken("tok");
    expect(isAuthenticated()).toBe(true);
    clearAccessToken();
    expect(isAuthenticated()).toBe(false);
  });

  it("clearAuthSession wipes both token and stored user", () => {
    setAccessToken("tok");
    setStoredUser(sampleUser);
    clearAuthSession();
    expect(getAccessToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});
