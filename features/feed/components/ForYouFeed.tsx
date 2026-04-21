import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  Share,
  type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
  Plus,
  Repeat2,
  Share2,
  TrendingUp,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api } from "@/lib/api";
import { FeedVideoPlayer } from "./FeedVideoPlayer";
import type { AppColors } from "@/constants/theme";
import type { Post } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const LIMIT = 10;

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i;

/** Returns the first video URL from mediaUrls, or null. */
function firstVideoUrl(urls: string[]): string | null {
  for (const u of urls) {
    if (VIDEO_EXTENSIONS.test(u)) return u;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ForYouFeed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  // Viewport-based video autoplay
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable);
      setVisiblePostId(first?.item?.id ?? null);
    }
  ).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  // UI state
  const [shareModalPost, setShareModalPost] = useState<Post | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );

  // ── Data fetching ────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async (offset: number, reset: boolean) => {
    try {
      const data = await api.get<{ posts?: Post[]; total?: number }>(
        `/posts/feed?limit=${LIMIT}&offset=${offset}`
      );
      const incoming = Array.isArray(data.posts) ? data.posts : [];
      const total =
        typeof data.total === "number" && !Number.isNaN(data.total)
          ? data.total
          : incoming.length;

      if (reset) {
        setPosts(incoming);
      } else {
        setPosts((prev) => [...prev, ...incoming]);
      }
      const newOffset = offset + incoming.length;
      offsetRef.current = newOffset;
      setHasMore(newOffset < total);
      setLoadError(null);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not load the feed.";
      setLoadError(message);
      if (reset) {
        setPosts([]);
        offsetRef.current = 0;
        setHasMore(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      offsetRef.current = 0;
      await loadFeed(0, true);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    offsetRef.current = 0;
    setHasMore(true);
    await loadFeed(0, true);
    setRefreshing(false);
  }, [loadFeed]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadFeed(offsetRef.current, false);
    setLoadingMore(false);
  }, [loadFeed, loadingMore, hasMore]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleLike = async (postId: string) => {
    // Optimistic toggle
    setPosts((prev) =>
      prev.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              viewerHasLiked: !p.viewerHasLiked,
              likeCount: !p.viewerHasLiked
                ? p.likeCount + 1
                : p.likeCount - 1,
            }
      )
    );
    try {
      await api.post(`/posts/${postId}/like`, {});
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                viewerHasLiked: !p.viewerHasLiked,
                likeCount: p.viewerHasLiked
                  ? p.likeCount + 1
                  : p.likeCount - 1,
              }
        )
      );
    }
  };

  const handleRepost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              viewerHasReposted: !p.viewerHasReposted,
              repostCount: p.viewerHasReposted
                ? p.repostCount - 1
                : p.repostCount + 1,
            }
      )
    );
  };

  const toggleReplies = (postId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const sharePost = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.title}\n\nwatchcuemobile://post/${post.id}`,
        title: post.title,
      });
    } catch {
      /* ignore */
    }
    setShareModalPost(null);
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  /**
   * Renders a profile picture URL if available, otherwise a gradient circle
   * with the first letter of the username as a fallback.
   */
  const renderAvatar = (
    profilePictureUrl: string | null | undefined,
    username: string,
    avatarStyle: object
  ) => {
    if (profilePictureUrl) {
      return (
        <Image
          source={{ uri: profilePictureUrl }}
          style={avatarStyle}
          contentFit="cover"
        />
      );
    }
    return (
      <LinearGradient
        colors={[colors.accentPink, colors.accent]}
        style={[avatarStyle, styles.avatarCenter]}
      >
        <Text style={styles.avatarInitial}>
          {(username || "?").charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
    );
  };

  const renderPost = ({ item: post }: { item: Post }) => {
    const areRepliesExpanded = expandedReplies.has(post.id);

    return (
      <View style={[styles.postCard, post.isHot && styles.postCardHot]}>
        <LinearGradient
          colors={[
            "rgba(255,77,109,0.20)",
            "rgba(168,85,247,0.10)",
            "rgba(0,201,177,0.16)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />

        {post.isHot && (
          <View style={styles.hotRow}>
            <TrendingUp width={14} height={14} color={colors.accentPink} />
            <Text style={styles.hotText}>Trending discussion</Text>
          </View>
        )}

        {/* ── Post header ── */}
        <View style={styles.postHeader}>
          <View style={styles.postHeaderLeft}>
            {renderAvatar(
              post.author?.profilePictureUrl,
              post.author?.username ?? "?",
              styles.avatar
            )}
            <View style={styles.headerMeta}>
              <LinearGradient
                colors={[colors.accentPink, colors.accentPurple, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.hubChip}
              >
                <Text style={styles.hubChipText}>{post.hub?.name}</Text>
              </LinearGradient>
              <View style={styles.userRow}>
                <Text style={styles.username}>
                  @{post.author?.username}
                </Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
              </View>
            </View>
          </View>
          <Pressable hitSlop={8}>
            <MoreVertical width={22} height={22} color={colors.muted} />
          </Pressable>
        </View>

        {/* ── Body / spoiler ── */}
        <Pressable onPress={() => router.push(`/post/${post.id}`)}>
          <Text style={styles.postTitle}>{post.title}</Text>
          {post.hasSpoiler ? (
            <View style={styles.spoilerWrap}>
              {Platform.OS === "ios" ? (
                <>
                  <Text style={styles.spoilerText} numberOfLines={5}>
                    {post.content}
                  </Text>
                  <BlurView
                    style={StyleSheet.absoluteFillObject}
                    intensity={55}
                    tint="dark"
                  />
                </>
              ) : null}
              <View style={styles.spoilerOverlay}>
                <View style={styles.spoilerBadge}>
                  <Eye width={15} height={15} color="#fff" />
                  <Text style={styles.spoilerBadgeText}>SPOILER WARNING</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.body} numberOfLines={3}>
              {post.content}
            </Text>
          )}
        </Pressable>

        {/* ── Media: video → image ── */}
        {(() => {
          const videoUrl = firstVideoUrl(post.mediaUrls);
          if (videoUrl) {
            return (
              <FeedVideoPlayer
                uri={videoUrl}
                isVisible={visiblePostId === post.id}
                style={styles.postImage}
                onPress={() => router.push(`/post/${post.id}`)}
              />
            );
          }
          if (post.mediaUrls.length > 0) {
            return (
              <Pressable onPress={() => router.push(`/post/${post.id}`)}>
                <Image
                  source={{ uri: post.mediaUrls[0] }}
                  style={styles.postImage}
                  contentFit="cover"
                />
              </Pressable>
            );
          }
          return null;
        })()}

        {/* ── Action bar ── */}
        <View style={styles.actions}>
          <Pressable onPress={() => handleLike(post.id)} style={styles.actionBtn}>
            <Heart
              width={22}
              height={22}
              color={post.viewerHasLiked ? colors.accentPink : colors.muted}
              fill={post.viewerHasLiked ? colors.accentPink : "transparent"}
            />
            <Text style={styles.actionCount}>{post.likeCount}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/post/${post.id}`)}
            style={styles.actionBtn}
          >
            <MessageCircle width={22} height={22} color={colors.muted} />
            <Text style={styles.actionCount}>{post.commentCount}</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRepost(post.id)}
            style={styles.actionBtn}
          >
            <Repeat2
              width={22}
              height={22}
              color={
                post.viewerHasReposted ? colors.accentPurple : colors.muted
              }
            />
            <Text style={styles.actionCount}>{post.repostCount}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShareModalPost(post)}
            style={styles.actionBtn}
          >
            <Share2 width={22} height={22} color={colors.muted} />
          </Pressable>
        </View>

        {/* ── Comments preview ── */}
        {post.topComments && post.topComments.length > 0 && (
          <View style={styles.repliesSection}>
            {!areRepliesExpanded ? (
              <View style={styles.replyBlock}>
                {post.topComments.slice(0, 2).map((comment) => (
                  <View key={comment.id} style={styles.replyRow}>
                    {renderAvatar(
                      comment.author?.profilePictureUrl,
                      comment.author?.username ?? "?",
                      styles.replyAvatar
                    )}
                    <View style={styles.replyBody}>
                      <View style={styles.userRow}>
                        <Text style={styles.username}>
                          @{comment.author?.username}
                        </Text>
                        <Text style={styles.dot}>·</Text>
                        <Text style={styles.time}>
                          {relativeTime(comment.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.replyContent} numberOfLines={2}>
                        {comment.content}
                      </Text>
                    </View>
                  </View>
                ))}
                <Pressable
                  onPress={() => toggleReplies(post.id)}
                  style={styles.viewAllReplies}
                >
                  <ChevronDown width={16} height={16} color={colors.accent} />
                  <Text style={styles.linkText}>
                    View all {post.commentCount} replies
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.replyBlock}>
                {post.topComments.map((comment) => (
                  <View key={comment.id} style={styles.replyRow}>
                    {renderAvatar(
                      comment.author?.profilePictureUrl,
                      comment.author?.username ?? "?",
                      styles.replyAvatar
                    )}
                    <View style={styles.replyBody}>
                      <View style={styles.userRow}>
                        <Text style={styles.username}>
                          @{comment.author?.username}
                        </Text>
                        <Text style={styles.dot}>·</Text>
                        <Text style={styles.time}>
                          {relativeTime(comment.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.replyContent}>
                        {comment.content}
                      </Text>
                    </View>
                  </View>
                ))}
                <Pressable
                  onPress={() => router.push(`/post/${post.id}`)}
                  style={styles.continueThread}
                >
                  <Text style={styles.linkText}>
                    Continue this conversation →
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleReplies(post.id)}
                  style={styles.viewAllReplies}
                >
                  <ChevronUp width={16} height={16} color={colors.accent} />
                  <Text style={styles.linkText}>Collapse replies</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Header (always visible, not part of the scroll) ──────────────────────────

  const feedHeader = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>For You</Text>
      <View style={styles.headerActions}>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={styles.iconBtn}
        >
          <Bell width={22} height={22} color={colors.text} />
          <View style={styles.notifDot} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/create-post")}
          style={styles.createBtn}
        >
          <LinearGradient
            colors={[colors.accentPink, colors.accentPurple, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createGradient}
          >
            <Plus width={22} height={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  // ── Initial loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        {feedHeader}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accentPink} />
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      {feedHeader}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={[
          styles.feed,
          { paddingBottom: insets.bottom + 16 },
          posts.length === 0 && styles.feedEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPink}
            colors={[colors.accentPink]}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.centered}>
            {loadError ? (
              <>
                <Text style={styles.emptyTitle}>Could not load your feed</Text>
                <Text style={styles.emptyErrorDetail} selectable>
                  {loadError}
                </Text>
                <Text style={[styles.emptyBody, styles.emptyHint]}>
                  Pull down to retry. HTTP 404 often means a route or prefix
                  mismatch — set EXPO_PUBLIC_API_PREFIX if your API uses a global
                  prefix. HTTP 401 means sign in again (clear stale token in app
                  data). On a real device, use your computer's LAN IP instead of
                  localhost in .env.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyBody}>
                  Follow more hubs to personalise your feed.
                </Text>
              </>
            )}
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.accentPink}
              style={styles.footerSpinner}
            />
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.endText}>You're all caught up!</Text>
          ) : null
        }
      />

      {/* Share modal */}
      <Modal
        visible={shareModalPost !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalPost(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShareModalPost(null)}
          />
          <View style={styles.modalWrap} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Share post</Text>
              {shareModalPost && (
                <Text style={styles.modalPreview} numberOfLines={2}>
                  {shareModalPost.title}
                </Text>
              )}
              <Pressable
                style={styles.modalPrimary}
                onPress={() => shareModalPost && sharePost(shareModalPost)}
              >
                <Text style={styles.modalPrimaryText}>Share via system…</Text>
              </Pressable>
              <Pressable onPress={() => setShareModalPost(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: c.text,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconBtn: { padding: 8 },
    notifDot: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.accentPink,
    },
    createBtn: { borderRadius: 999, overflow: "hidden" },
    createGradient: {
      padding: 10,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },

    // Feed list
    feed: { paddingHorizontal: "1%", paddingVertical: 16, gap: 16 },
    feedEmpty: { flexGrow: 1 },

    // Post card
    postCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      overflow: "hidden",
      width: "98%",
      alignSelf: "center",
    },
    postCardHot: {},
    hotRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    hotText: { fontSize: 12, fontWeight: "600", color: c.accentPink },
    postHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    postHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarCenter: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontSize: 16, fontWeight: "700", color: "#fff" },
    headerMeta: { flex: 1 },
    hubChip: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      marginBottom: 4,
    },
    hubChipText: { fontSize: 11, fontWeight: "600", color: "#fff" },
    userRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    username: { fontSize: 12, fontWeight: "600", color: c.text },
    dot: { fontSize: 12, color: c.muted },
    time: { fontSize: 12, color: c.muted },
    postTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    body: {
      fontSize: 14,
      color: c.muted,
      lineHeight: 20,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    spoilerWrap: {
      marginHorizontal: 16,
      marginBottom: 8,
      minHeight: 80,
      justifyContent: "center",
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: c.surface,
    },
    spoilerText: {
      fontSize: 14,
      color: c.text,
      lineHeight: 20,
    },
    spoilerOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    spoilerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.accentPink,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },
    spoilerBadgeText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 12,
      letterSpacing: 0.4,
    },
    postImage: { width: "100%", height: 220, marginTop: 8 },

    // Actions
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionCount: { fontSize: 14, color: c.muted },

    // Comments preview
    repliesSection: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    replyBlock: { gap: 12 },
    replyRow: {
      flexDirection: "row",
      gap: 10,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: "rgba(0, 201, 177, 0.35)",
    },
    replyAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
    },
    replyBody: { flex: 1 },
    replyContent: { fontSize: 14, color: c.muted, marginTop: 4 },
    viewAllReplies: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingLeft: 12,
    },
    continueThread: { paddingLeft: 12, paddingVertical: 8 },
    linkText: { color: c.accent, fontSize: 14, fontWeight: "500" },

    // Empty / loading states
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: c.text,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyBody: {
      fontSize: 14,
      color: c.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    emptyHint: {
      marginTop: 16,
      fontSize: 13,
    },
    emptyErrorDetail: {
      fontSize: 14,
      color: c.text,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 4,
    },
    footerSpinner: { marginVertical: 20 },
    endText: {
      textAlign: "center",
      color: c.muted,
      fontSize: 13,
      paddingVertical: 20,
    },

    // Share modal
    modalRoot: { flex: 1, justifyContent: "center" },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalWrap: { padding: 24, zIndex: 1 },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: c.text,
      marginBottom: 8,
    },
    modalPreview: { fontSize: 14, color: c.muted, marginBottom: 16 },
    modalPrimary: {
      backgroundColor: c.accent,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginBottom: 12,
    },
    modalPrimaryText: { color: "#fff", fontWeight: "600", fontSize: 16 },
    modalCancel: {
      textAlign: "center",
      color: c.muted,
      fontSize: 16,
      paddingVertical: 8,
    },
  });
}
