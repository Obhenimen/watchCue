// ── Shared ────────────────────────────────────────────────────────────────────

/** Author shape returned inside post/comment joins by the NestJS backend. */
export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

// ── Hubs ──────────────────────────────────────────────────────────────────────
/** Lightweight hub shape returned inside post joins. */
export interface HubSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  type: "movie" | "series";
  /** Comma-separated genre tags, e.g. "Sci-Fi, Drama". May be null. */
  genres?: string | null;
}

// ── Posts ─────────────────────────────────────────────────────────────────────
export type MediaType = "none" | "image" | "video";

export interface Post {
  id: string;
  userId: string;
  hubId: string;

  title: string | null;
  body: string;
  hasSpoiler: boolean;

  mediaType: MediaType;
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoDurationSecs: number | null;

  likesCount: number;
  commentsCount: number;
  repostsCount: number;

  createdAt: string;
  updatedAt: string | null;

  likedByMe: boolean;
  repostedByMe: boolean;

  author: UserSummary | null;
  hub: HubSummary | null;

  /** Up to 2 most recent top-level comments, included by /posts/feed. */
  topComments?: TopCommentPreview[];
}

// ── Comments ──────────────────────────────────────────────────────────────────
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;

  body: string;
  likesCount: number;
  likedByMe: boolean;

  createdAt: string;
  updatedAt: string | null;

  author: UserSummary | null;
}

/** Lightweight comment shape attached to feed posts (no viewer state). */
export interface TopCommentPreview {
  id: string;
  body: string;
  likesCount: number;
  createdAt: string;
  author: UserSummary | null;
}

// ── API responses ─────────────────────────────────────────────────────────────
export interface FeedResponse {
  posts: Post[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CommentsResponse {
  comments: Comment[];
  nextCursor: string | null;
  hasNextPage: boolean;
}
