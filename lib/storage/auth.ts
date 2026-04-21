import { storage } from "./mmkv";

const KEYS = {
  ACCESS_TOKEN: "auth.accessToken",
  USER: "auth.user",
} as const;

/**
 * Users table
 *
 * Relationships:
 *   User  ←──<  Posts        (one user authors many posts)
 *   User  ←──<  Comments     (one user authors many comments)
 *   User  ←──<  PostLikes    (one user likes many posts)
 *   User  ←──<  PostReposts
 *   User  ←──<  CommentLikes
 *   User  ←──<  HubMembers   (one user joins many hubs)
 *   User  ←──<  UserFollows  (as followerId — accounts this user follows)
 *   User  ←──<  UserFollows  (as followingId — accounts that follow this user)
 *
 * Note: passwordHash is never sent to the client — it lives server-side only.
 */
export interface StoredUser {
  id: string;
  email: string;
  username: string;
  /** Full name — maps to backend User.name */
  name: string;
  bio: string | null;
  profilePictureUrl: string | null;
  genres: string[];
  watchedMovieIds: number[];
  createdAt: string;  // ISO-8601
}

// ── Token ─────────────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return storage.getString(KEYS.ACCESS_TOKEN) ?? null;
}

export function setAccessToken(token: string): void {
  storage.set(KEYS.ACCESS_TOKEN, token);
}

export function clearAccessToken(): void {
  storage.remove(KEYS.ACCESS_TOKEN);
}

// ── User ──────────────────────────────────────────────────────────────────────

export function getStoredUser(): StoredUser | null {
  const raw = storage.getString(KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  storage.set(KEYS.USER, JSON.stringify(user));
}

export function clearStoredUser(): void {
  storage.remove(KEYS.USER);
}

// ── Session ───────────────────────────────────────────────────────────────────

/** Call on logout or account deletion — wipes all auth data */
export function clearAuthSession(): void {
  clearAccessToken();
  clearStoredUser();
}

/** True if a token is currently stored (does not validate expiry) */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
