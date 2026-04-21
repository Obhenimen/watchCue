// ── Shared ────────────────────────────────────────────────────────────────────

/**
 * Lightweight user shape returned inside joins.
 * Full profile lives in the Users table (StoredUser in lib/storage/auth.ts).
 */
export interface UserSummary {
  id: string;
  username: string;
  /** Full name — matches the backend User.name field */
  name: string;
  /** Profile picture URL — matches backend User.profilePictureUrl */
  profilePictureUrl: string | null;
  isVerified: boolean;
}

// ── Hubs ──────────────────────────────────────────────────────────────────────
/**
 * One Hub per show / film. Posts and members belong to a Hub.
 *
 * Relationships:
 *   Hub  ←──<  Posts      (one hub has many posts)
 *   Hub  ←──<  HubMembers (one hub has many members)
 */
export interface Hub {
  id: string;
  name: string;
  slug: string;               // URL-friendly unique identifier  e.g. "dune-part-two"
  description: string | null;
  type: "movie" | "tv";
  tmdbId: number | null;      // The Movie DB external ID for poster/metadata sync
  coverImageUrl: string | null;
  memberCount: number;        // denormalized — updated by trigger
  postCount: number;          // denormalized — updated by trigger
  createdAt: string;          // ISO-8601
  updatedAt: string;
}

// ── Posts ─────────────────────────────────────────────────────────────────────
/**
 * Relationships:
 *   Post  >──  Users  (many posts belong to one user)
 *   Post  >──  Hubs   (many posts belong to one hub)
 *   Post  ←──<  Comments   (one post has many comments)
 *   Post  ←──<  PostLikes  (one post has many likes)
 *   Post  ←──<  PostReposts
 */
export interface Post {
  // ── Primary key ─────────────────────────────────────────────────────────────
  id: string;

  // ── Foreign keys (raw table columns) ────────────────────────────────────────
  userId: string;   // → Users.id  (author)
  hubId: string;    // → Hubs.id

  // ── Content ──────────────────────────────────────────────────────────────────
  title: string;
  content: string;
  hasSpoiler: boolean;
  youtubeUrl?: string | null;  // YouTube trailer/clip URL — rendered as thumbnail + play button
  mediaUrls: string[];  // ordered list of image/video URLs (replaces hasImage + imageUrl)

  // ── Denormalized counts (updated by DB triggers or background jobs) ──────────
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number;

  // ── Server-computed / moderator flags ────────────────────────────────────────
  isHot: boolean;        // trending — set by engagement algorithm
  isPinned: boolean;     // pinned inside its Hub by a moderator
  isDeleted: boolean;    // soft delete — keeps row for audit / reply chains

  // ── Timestamps ───────────────────────────────────────────────────────────────
  createdAt: string;     // ISO-8601
  updatedAt: string;

  // ── Hydrated by API (joined relations — NOT stored in Posts table) ───────────
  author?: UserSummary;
  hub?: Hub;
  viewerHasLiked?: boolean;    // true if the requesting user has liked this post
  viewerHasReposted?: boolean;
  topComments?: Comment[];     // preview comments shown on the feed card
}

// ── Comments ──────────────────────────────────────────────────────────────────
/**
 * Self-referential for nesting: parentCommentId === null → top-level comment.
 * The app enforces a max depth (e.g. 3) to keep threads readable.
 *
 * Relationships:
 *   Comment  >──  Users    (many comments belong to one user)
 *   Comment  >──  Posts    (many comments belong to one post)
 *   Comment  >──  Comments (many replies belong to one parent comment)
 *   Comment  ←──<  Comments    (one comment has many replies)
 *   Comment  ←──<  CommentLikes
 */
export interface Comment {
  // ── Primary key ─────────────────────────────────────────────────────────────
  id: string;

  // ── Foreign keys ─────────────────────────────────────────────────────────────
  postId: string;                  // → Posts.id
  userId: string;                  // → Users.id
  parentCommentId: string | null;  // → Comments.id  (null = top-level comment)

  // ── Content ──────────────────────────────────────────────────────────────────
  content: string;
  hasSpoiler: boolean;

  // ── Denormalized counts ───────────────────────────────────────────────────────
  likeCount: number;
  replyCount: number;   // number of direct children

  // ── Nesting depth ────────────────────────────────────────────────────────────
  // 0 = top-level, 1 = reply to a comment, 2 = reply to a reply, etc.
  depth: number;

  // ── Flags ────────────────────────────────────────────────────────────────────
  isDeleted: boolean;

  // ── Timestamps ───────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;

  // ── Hydrated by API ──────────────────────────────────────────────────────────
  author?: UserSummary;
  viewerHasLiked?: boolean;
  replies?: Comment[];   // direct children — same shape (recursive)
}

// ── Junction tables ───────────────────────────────────────────────────────────
// Each has a composite primary key formed by its two FK columns.

/** Tracks which users liked which posts.       PK: (userId, postId) */
export interface PostLike {
  userId: string;   // → Users.id
  postId: string;   // → Posts.id
  createdAt: string;
}

/** Tracks which users reposted which posts.    PK: (userId, postId) */
export interface PostRepost {
  userId: string;   // → Users.id
  postId: string;   // → Posts.id
  createdAt: string;
}

/** Tracks which users liked which comments.    PK: (userId, commentId) */
export interface CommentLike {
  userId: string;     // → Users.id
  commentId: string;  // → Comments.id
  createdAt: string;
}

/** Social graph — who follows whom.            PK: (followerId, followingId) */
export interface UserFollow {
  followerId: string;   // → Users.id  (the person following)
  followingId: string;  // → Users.id  (the person being followed)
  createdAt: string;
}

/** Hub membership and roles.                   PK: (userId, hubId) */
export interface HubMember {
  userId: string;  // → Users.id
  hubId: string;   // → Hubs.id
  role: "member" | "moderator" | "owner";
  joinedAt: string;
}
