import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  MoreVertical,
  Repeat2,
  Send,
  Share2,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api, mediaUrl } from "@/lib/api";
import { FeedVideoPlayer } from "@/features/feed/components/FeedVideoPlayer";
import type { AppColors } from "@/constants/theme";
import type {
  Comment,
  CommentsResponse,
  Post,
  UserSummary,
} from "@/features/feed/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - t.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type SortMode = "best" | "new";

// ── Avatar (shared) ───────────────────────────────────────────────────────────

function Avatar({
  user,
  size,
  styles,
  colors,
}: {
  user: Pick<UserSummary, "username" | "displayName" | "avatarUrl"> | null | undefined;
  size: number;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  const resolved = mediaUrl(user?.avatarUrl);
  const initial =
    (user?.username ?? user?.displayName ?? "?").charAt(0).toUpperCase();
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (resolved) {
    return <Image source={{ uri: resolved }} style={dim} contentFit="cover" />;
  }
  return (
    <LinearGradient
      colors={[colors.accentPink, colors.accent]}
      style={[dim, styles.avatarCenter]}
    >
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>
        {initial}
      </Text>
    </LinearGradient>
  );
}

// ── Single comment (with optional replies) ───────────────────────────────────

function CommentItem({
  comment,
  postId,
  depth,
  onLikeComment,
  styles,
  colors,
}: {
  comment: Comment;
  postId: string;
  depth: number;
  onLikeComment: (id: string) => Promise<void>;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  const router = useRouter();
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [hasLoadedReplies, setHasLoadedReplies] = useState(false);

  // Reply composer
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const data = await api.get<CommentsResponse>(
        `/comments/${comment.id}/replies?limit=50`,
      );
      setReplies(Array.isArray(data.comments) ? data.comments : []);
      setHasLoadedReplies(true);
    } catch {
      // Silent — leave the toggle open with whatever we have.
    } finally {
      setLoadingReplies(false);
    }
  }, [comment.id]);

  const toggleReplies = useCallback(() => {
    const next = !showReplies;
    setShowReplies(next);
    if (next && !hasLoadedReplies) loadReplies();
  }, [showReplies, hasLoadedReplies, loadReplies]);

  const submitReply = useCallback(async () => {
    const body = replyText.trim();
    if (!body || submittingReply) return;
    setSubmittingReply(true);
    try {
      const created = await api.post<Comment>(
        `/posts/${postId}/comments`,
        { body, parentId: comment.id },
      );
      setReplies((prev) => [...prev, created]);
      setReplyText("");
      setReplyOpen(false);
      if (!showReplies) {
        setShowReplies(true);
        setHasLoadedReplies(true);
      }
    } catch {
      // Keep the input populated so user can retry.
    } finally {
      setSubmittingReply(false);
    }
  }, [replyText, submittingReply, postId, comment.id, showReplies]);

  const authorId = comment.author?.id;

  return (
    <View style={[styles.commentRow, depth > 0 && styles.commentRowNested]}>
      <Pressable
        onPress={() => authorId && router.push(`/user/${authorId}`)}
        hitSlop={4}
      >
        <Avatar user={comment.author} size={36} styles={styles} colors={colors} />
      </Pressable>
      <View style={styles.commentBody}>
        <View style={styles.commentMetaRow}>
          <Pressable
            onPress={() => authorId && router.push(`/user/${authorId}`)}
            hitSlop={4}
          >
            <Text style={styles.commentUsername}>
              @{comment.author?.username ?? "unknown"}
            </Text>
          </Pressable>
          <Text style={styles.commentTime}>
            {relativeTime(comment.createdAt)}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.body}</Text>

        <View style={styles.commentActions}>
          <Pressable
            onPress={() => onLikeComment(comment.id)}
            style={styles.commentActionBtn}
            hitSlop={6}
          >
            <Heart
              width={16}
              height={16}
              color={comment.likedByMe ? colors.accentPink : colors.muted}
              fill={comment.likedByMe ? colors.accentPink : "transparent"}
            />
            <Text style={styles.commentActionText}>{comment.likesCount}</Text>
          </Pressable>
          <Pressable
            onPress={() => setReplyOpen((v) => !v)}
            style={styles.commentActionBtn}
            hitSlop={6}
          >
            <Text style={styles.commentActionText}>Reply</Text>
          </Pressable>
          {/* Replies toggle — depth 0 only (no infinite nesting in UI) */}
          {depth === 0 && (
            <Pressable
              onPress={toggleReplies}
              style={styles.commentActionBtn}
              hitSlop={6}
            >
              {showReplies ? (
                <ChevronUp width={14} height={14} color={colors.accent} />
              ) : (
                <ChevronDown width={14} height={14} color={colors.accent} />
              )}
              <Text style={[styles.commentActionText, { color: colors.accent }]}>
                {showReplies ? "Hide replies" : "Show replies"}
              </Text>
            </Pressable>
          )}
        </View>

        {replyOpen && (
          <View style={styles.replyComposer}>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder={`Reply to @${comment.author?.username ?? "user"}…`}
              placeholderTextColor={colors.muted}
              style={styles.replyInput}
              multiline
            />
            <Pressable
              onPress={submitReply}
              disabled={submittingReply || !replyText.trim()}
              style={[
                styles.replySendBtn,
                (!replyText.trim() || submittingReply) && styles.replySendBtnDisabled,
              ]}
            >
              {submittingReply ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send width={14} height={14} color="#fff" />
              )}
            </Pressable>
          </View>
        )}

        {showReplies && (
          <View style={styles.repliesContainer}>
            {loadingReplies && replies.length === 0 ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  postId={postId}
                  depth={depth + 1}
                  onLikeComment={onLikeComment}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function PostScreen({ postId }: { postId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("best");

  // Top-level composer
  const [composerText, setComposerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const load = useCallback(async () => {
    try {
      const [postData, commentsData] = await Promise.all([
        api.get<Post>(`/posts/${postId}`),
        api.get<CommentsResponse>(`/posts/${postId}/comments?limit=50`),
      ]);
      setPost(postData);
      setComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this post.");
    }
  }, [postId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Sort comments client-side. "best" = highest likes first; "new" = newest first.
  const sortedComments = useMemo(() => {
    const list = [...comments];
    if (sort === "best") {
      list.sort((a, b) => {
        if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list;
  }, [comments, sort]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const togglePostLike = useCallback(async () => {
    if (!post) return;
    const before = { likedByMe: post.likedByMe, likesCount: post.likesCount };
    setPost({
      ...post,
      likedByMe: !post.likedByMe,
      likesCount: post.likedByMe ? post.likesCount - 1 : post.likesCount + 1,
    });
    try {
      const res = await api.post<{ liked: boolean; likesCount: number }>(
        `/posts/${post.id}/like`,
        {},
      );
      setPost((p) => (p ? { ...p, likedByMe: res.liked, likesCount: res.likesCount } : p));
    } catch {
      setPost((p) => (p ? { ...p, ...before } : p));
    }
  }, [post]);

  const togglePostRepost = useCallback(async () => {
    if (!post) return;
    const before = { repostedByMe: post.repostedByMe, repostsCount: post.repostsCount };
    setPost({
      ...post,
      repostedByMe: !post.repostedByMe,
      repostsCount: post.repostedByMe ? post.repostsCount - 1 : post.repostsCount + 1,
    });
    try {
      const res = await api.post<{ reposted: boolean; repostsCount: number }>(
        `/posts/${post.id}/repost`,
        {},
      );
      setPost((p) =>
        p ? { ...p, repostedByMe: res.reposted, repostsCount: res.repostsCount } : p,
      );
    } catch {
      setPost((p) => (p ? { ...p, ...before } : p));
    }
  }, [post]);

  const likeComment = useCallback(async (commentId: string) => {
    // Optimistic
    setComments((prev) =>
      prev.map((c) =>
        c.id !== commentId
          ? c
          : {
              ...c,
              likedByMe: !c.likedByMe,
              likesCount: c.likedByMe ? c.likesCount - 1 : c.likesCount + 1,
            },
      ),
    );
    try {
      const res = await api.post<{ liked: boolean; likesCount: number }>(
        `/comments/${commentId}/like`,
        {},
      );
      setComments((prev) =>
        prev.map((c) =>
          c.id !== commentId ? c : { ...c, likedByMe: res.liked, likesCount: res.likesCount },
        ),
      );
    } catch {
      // Revert
      setComments((prev) =>
        prev.map((c) =>
          c.id !== commentId
            ? c
            : {
                ...c,
                likedByMe: !c.likedByMe,
                likesCount: c.likedByMe ? c.likesCount - 1 : c.likesCount + 1,
              },
        ),
      );
    }
  }, []);

  const submitComment = useCallback(async () => {
    const body = composerText.trim();
    if (!body || submitting || !post) return;
    setSubmitting(true);
    try {
      const created = await api.post<Comment>(
        `/posts/${post.id}/comments`,
        { body },
      );
      setComments((prev) => [created, ...prev]);
      setPost((p) =>
        p ? { ...p, commentsCount: p.commentsCount + 1 } : p,
      );
      setComposerText("");
      inputRef.current?.blur();
    } catch {
      /* keep text, let the user retry */
    } finally {
      setSubmitting(false);
    }
  }, [composerText, submitting, post]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Post</Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accentPink} />
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load this post</Text>
          {error && <Text style={styles.errorBody} selectable>{error}</Text>}
        </View>
      </View>
    );
  }

  const videoSrc = post.mediaType === "video" ? mediaUrl(post.videoUrl) : null;
  const posterSrc = mediaUrl(post.videoThumbnailUrl);
  const imgSrc = post.mediaType === "image" ? mediaUrl(post.imageUrl) : null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {header}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPink}
            colors={[colors.accentPink]}
          />
        }
      >
        {/* ── Post card ── */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <Pressable
              onPress={() =>
                post.author?.id && router.push(`/user/${post.author.id}`)
              }
              hitSlop={4}
            >
              <Avatar user={post.author} size={40} styles={styles} colors={colors} />
            </Pressable>
            <View style={styles.postHeaderMeta}>
              <Pressable
                onPress={() =>
                  post.hub?.id && router.push(`/hub/${post.hub.id}`)
                }
                hitSlop={4}
                style={{ alignSelf: "flex-start" }}
              >
                <LinearGradient
                  colors={[
                    colors.accentPink,
                    colors.accentPurple,
                    colors.accent,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.hubChip}
                >
                  <Text style={styles.hubChipText}>
                    {post.hub?.name ?? "Hub"}
                  </Text>
                </LinearGradient>
              </Pressable>
              <View style={styles.userRow}>
                <Pressable
                  onPress={() =>
                    post.author?.id && router.push(`/user/${post.author.id}`)
                  }
                  hitSlop={4}
                >
                  <Text style={styles.username}>
                    @{post.author?.username ?? "unknown"}
                  </Text>
                </Pressable>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
              </View>
            </View>
            <Pressable hitSlop={8}>
              <MoreVertical width={22} height={22} color={colors.muted} />
            </Pressable>
          </View>

          {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
          <Text style={styles.body}>{post.body}</Text>

          {videoSrc ? (
            <FeedVideoPlayer
              uri={videoSrc}
              posterUri={posterSrc}
              isVisible
              style={styles.media}
            />
          ) : imgSrc ? (
            <Image source={{ uri: imgSrc }} style={styles.media} contentFit="cover" />
          ) : null}

          {/* Stats */}
          <Text style={styles.stats}>
            {post.likesCount} likes · {post.commentsCount} comments ·{" "}
            {post.repostsCount} reposts
          </Text>

          {/* Action bar with labels */}
          <View style={styles.actionBar}>
            <Pressable onPress={togglePostLike} style={styles.actionBtn}>
              <Heart
                width={20}
                height={20}
                color={post.likedByMe ? colors.accentPink : colors.text}
                fill={post.likedByMe ? colors.accentPink : "transparent"}
              />
              <Text style={styles.actionLabel}>Like</Text>
            </Pressable>
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={styles.actionBtn}
            >
              <MessageCircle width={20} height={20} color={colors.text} />
              <Text style={styles.actionLabel}>Comment</Text>
            </Pressable>
            <Pressable onPress={togglePostRepost} style={styles.actionBtn}>
              <Repeat2
                width={20}
                height={20}
                color={post.repostedByMe ? colors.accentPurple : colors.text}
              />
              <Text style={styles.actionLabel}>Repost</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Share2 width={20} height={20} color={colors.text} />
              <Text style={styles.actionLabel}>Share</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Comments section ── */}
        <View style={styles.commentsCard}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>
              Comments ({post.commentsCount})
            </Text>
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setSort("best")}
                style={[styles.tab, sort === "best" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    sort === "best" && styles.tabTextActive,
                  ]}
                >
                  Best
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSort("new")}
                style={[styles.tab, sort === "new" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    sort === "new" && styles.tabTextActive,
                  ]}
                >
                  New
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Composer */}
          <View style={styles.composer}>
            <Avatar user={null} size={36} styles={styles} colors={colors} />
            <View style={styles.composerInputWrap}>
              <TextInput
                ref={inputRef}
                value={composerText}
                onChangeText={setComposerText}
                placeholder="Add a comment..."
                placeholderTextColor={colors.muted}
                style={styles.composerInput}
                multiline
              />
              <Pressable
                onPress={submitComment}
                disabled={submitting || !composerText.trim()}
                style={[
                  styles.composerReply,
                  (!composerText.trim() || submitting) && styles.composerReplyDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <>
                    <Send width={14} height={14} color={colors.accent} />
                    <Text style={[styles.composerReplyText, { color: colors.accent }]}>
                      Reply
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.commentsList}>
            {sortedComments.length === 0 ? (
              <Text style={styles.emptyComments}>
                Be the first to comment.
              </Text>
            ) : (
              sortedComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  postId={post.id}
                  depth={0}
                  onLikeComment={likeComment}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: c.text },

    scrollContent: { padding: 12, gap: 12 },

    // Post card
    postCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      gap: 12,
    },
    postHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    postHeaderMeta: { flex: 1, gap: 4 },
    hubChip: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    hubChipText: { color: "#fff", fontWeight: "700", fontSize: 11 },
    userRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    username: { fontSize: 13, fontWeight: "600", color: c.text },
    dot: { fontSize: 12, color: c.muted },
    time: { fontSize: 12, color: c.muted },

    title: { fontSize: 18, fontWeight: "700", color: c.text, lineHeight: 24 },
    body: { fontSize: 15, color: c.text, lineHeight: 22 },
    media: {
      width: "100%",
      height: 220,
      borderRadius: 10,
      backgroundColor: "#000",
    },

    stats: {
      fontSize: 13,
      color: c.muted,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: 4,
      paddingBottom: 4,
    },

    actionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    actionLabel: { fontSize: 14, color: c.text, fontWeight: "500" },

    // Avatars
    avatarCenter: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: "#fff", fontWeight: "700" },

    // Comments section
    commentsCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      gap: 14,
    },
    commentsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    commentsTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    tabRow: {
      flexDirection: "row",
      backgroundColor: c.background,
      borderRadius: 999,
      padding: 2,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
    },
    tabActive: { backgroundColor: "rgba(0,201,177,0.18)" },
    tabText: { fontSize: 13, color: c.muted, fontWeight: "600" },
    tabTextActive: { color: c.accent },

    // Composer
    composer: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    composerInputWrap: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 12,
      backgroundColor: c.background,
      padding: 10,
      gap: 8,
    },
    composerInput: {
      color: c.text,
      fontSize: 14,
      minHeight: 40,
      maxHeight: 120,
      textAlignVertical: "top",
      padding: 0,
    },
    composerReply: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-end",
    },
    composerReplyDisabled: { opacity: 0.5 },
    composerReplyText: { fontWeight: "600", fontSize: 13 },

    commentsList: { gap: 16 },
    emptyComments: {
      fontSize: 14,
      color: c.muted,
      textAlign: "center",
      paddingVertical: 16,
    },

    // Comment row
    commentRow: { flexDirection: "row", gap: 10 },
    commentRowNested: {
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: "rgba(0, 201, 177, 0.35)",
    },
    commentBody: { flex: 1, gap: 4 },
    commentMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    commentUsername: { fontSize: 13, fontWeight: "600", color: c.text },
    commentTime: { fontSize: 12, color: c.muted },
    commentText: { fontSize: 14, color: c.text, lineHeight: 20 },
    commentActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginTop: 4,
    },
    commentActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    commentActionText: { fontSize: 12, color: c.muted, fontWeight: "500" },
    repliesContainer: { marginTop: 10, gap: 12 },

    // Reply composer (inline)
    replyComposer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      marginTop: 8,
    },
    replyInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.background,
      color: c.text,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      minHeight: 36,
      maxHeight: 100,
    },
    replySendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    replySendBtnDisabled: { opacity: 0.5 },

    // Loading / error
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 8,
    },
    errorTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    errorBody: { fontSize: 13, color: c.muted, textAlign: "center" },
  });
}
