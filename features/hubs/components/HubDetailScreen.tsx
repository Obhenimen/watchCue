import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Heart,
  MessageCircle,
  MoreVertical,
  Plus,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api, mediaUrl } from "@/lib/api";
import type { AppColors } from "@/constants/theme";
import type { Post } from "@/features/feed/types";
import type { Hub } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(v);
}

function relativeTime(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - t.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Stable hue per id so empty backdrops aren't all the same colour. */
function gradientFor(seed: string): readonly [string, string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const palettes: readonly (readonly [string, string, string])[] = [
    ["#ff7a8a", "#c8a2c8", "#7ed8c4"],
    ["#ff6b6b", "#ffa07a", "#7ed8c4"],
    ["#a18cd1", "#fbc2eb", "#7ed8c4"],
    ["#ff9a9e", "#fad0c4", "#a1c4fd"],
    ["#f6d365", "#fda085", "#fbc2eb"],
    ["#84fab0", "#8fd3f4", "#a18cd1"],
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

const PAGE_SIZE = 10;
type SortMode = "trending" | "new" | "top";

// ── Compact post card (hub view — no hub chip, lean actions) ─────────────────

function HubPostCard({
  post,
  onPress,
  onLike,
  onPressAuthor,
  styles,
  colors,
}: {
  post: Post;
  onPress: () => void;
  onLike: () => void;
  onPressAuthor: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  const avatarSrc = mediaUrl(post.author?.avatarUrl);
  return (
    <Pressable onPress={onPress} style={styles.postCard}>
      <View style={styles.postHeader}>
        <Pressable onPress={onPressAuthor} hitSlop={4}>
          {avatarSrc ? (
            <Image source={{ uri: avatarSrc }} style={styles.avatar} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[colors.accentPink, colors.accent]}
              style={[styles.avatar, styles.avatarCenter]}
            >
              <Text style={styles.avatarInitial}>
                {(post.author?.username ?? "?").charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </Pressable>
        <View style={styles.userRow}>
          <Pressable onPress={onPressAuthor} hitSlop={4}>
            <Text style={styles.username}>@{post.author?.username ?? "unknown"}</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
        </View>
        <Pressable hitSlop={8}>
          <MoreVertical width={18} height={18} color={colors.muted} />
        </Pressable>
      </View>
      {post.title ? (
        <Text style={styles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>
      ) : null}
      <Text style={styles.postBody} numberOfLines={3}>
        {post.body}
      </Text>
      <View style={styles.postActions}>
        <Pressable onPress={onLike} style={styles.actionBtn} hitSlop={6}>
          <Heart
            width={18}
            height={18}
            color={post.likedByMe ? colors.accentPink : colors.muted}
            fill={post.likedByMe ? colors.accentPink : "transparent"}
          />
          <Text style={styles.actionCount}>{post.likesCount}</Text>
        </Pressable>
        <Pressable onPress={onPress} style={styles.actionBtn} hitSlop={6}>
          <MessageCircle width={18} height={18} color={colors.muted} />
          <Text style={styles.actionCount}>{post.commentsCount}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function HubDetailScreen({ hubId }: { hubId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hub, setHub] = useState<Hub | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<SortMode>("trending");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // True while a sort-tab change is fetching its first page — keeps the empty
  // branch from flashing "No posts in this hub yet." between tabs.
  const [postsLoading, setPostsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadHub = useCallback(async () => {
    try {
      const data = await api.get<Hub>(`/hubs/${hubId}`);
      setHub(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this hub.");
    }
  }, [hubId]);

  const loadPosts = useCallback(
    async (s: SortMode, cursor: string | null, reset: boolean) => {
      try {
        const params = new URLSearchParams({ sort: s, limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const data = await api.get<{
          posts: Post[];
          nextCursor: string | null;
          hasNextPage: boolean;
        }>(`/hubs/${hubId}/posts?${params.toString()}`);
        const incoming = Array.isArray(data.posts) ? data.posts : [];
        if (reset) {
          setPosts(incoming);
        } else {
          setPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const fresh = incoming.filter((p) => !seen.has(p.id));
            return fresh.length === 0 ? prev : [...prev, ...fresh];
          });
        }
        cursorRef.current = data.nextCursor ?? null;
        setHasMore(!!data.hasNextPage && !!data.nextCursor);
        setPostsError(null);
      } catch (e) {
        if (reset) setPosts([]);
        const msg = e instanceof Error ? e.message : "Could not load posts.";
        setPostsError(msg);
        if (__DEV__) console.warn("[HubDetailScreen] loadPosts failed", msg);
      }
    },
    [hubId],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      cursorRef.current = null;
      await Promise.all([loadHub(), loadPosts(sort, null, true)]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId]);

  // Sort change → refetch posts only
  const onChangeSort = useCallback(
    async (next: SortMode) => {
      if (next === sort) return;
      setSort(next);
      cursorRef.current = null;
      setHasMore(true);
      setPosts([]);
      setPostsError(null);
      setPostsLoading(true);
      try {
        await loadPosts(next, null, true);
      } finally {
        setPostsLoading(false);
      }
    },
    [sort, loadPosts],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = null;
    setHasMore(true);
    await Promise.all([loadHub(), loadPosts(sort, null, true)]);
    setRefreshing(false);
  }, [loadHub, loadPosts, sort]);

  const onEndReached = useCallback(async () => {
    if (inFlightRef.current || !hasMore || !cursorRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      await loadPosts(sort, cursorRef.current, false);
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [loadPosts, sort, hasMore]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleFollow = useCallback(async () => {
    if (!hub || followPending) return;
    setFollowPending(true);
    const before = {
      followedByMe: hub.followedByMe ?? false,
      followersCount: hub.followersCount,
    };
    setHub({
      ...hub,
      followedByMe: !before.followedByMe,
      followersCount: before.followedByMe
        ? before.followersCount - 1
        : before.followersCount + 1,
    });
    try {
      const res = await api.post<{ followed: boolean; followersCount?: number }>(
        `/hubs/${hub.id}/follow`,
        {},
      );
      setHub((h) =>
        h
          ? {
              ...h,
              followedByMe: res.followed,
              followersCount:
                typeof res.followersCount === "number"
                  ? res.followersCount
                  : h.followersCount,
            }
          : h,
      );
    } catch {
      setHub((h) => (h ? { ...h, ...before } : h));
    } finally {
      setFollowPending(false);
    }
  }, [hub, followPending]);

  const likePost = useCallback(async (postId: string) => {
    const before = posts.find((p) => p.id === postId);
    if (!before) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              likedByMe: !p.likedByMe,
              likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1,
            },
      ),
    );
    try {
      const res = await api.post<{ liked: boolean; likesCount: number }>(
        `/posts/${postId}/like`,
        {},
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : { ...p, likedByMe: res.liked, likesCount: res.likesCount },
        ),
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : { ...p, likedByMe: before.likedByMe, likesCount: before.likesCount },
        ),
      );
    }
  }, [posts]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderHeaderTop = (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <Text style={styles.topBarTitle} numberOfLines={1}>
        {hub?.name ?? "Hub"}
      </Text>
      <View style={styles.backBtn} />
    </View>
  );

  const renderHubHeader = () => {
    if (!hub) return null;
    const backdrop = mediaUrl(hub.backdropUrl);
    const icon = mediaUrl(hub.iconUrl);
    const palette = gradientFor(hub.id);
    const followed = !!hub.followedByMe;
    const metaParts = [
      hub.year != null ? String(hub.year) : null,
      hub.genres?.trim() || null,
      hub.director?.trim() || null,
    ].filter(Boolean) as string[];

    return (
      <View>
        <View style={styles.backdropWrap}>
          {backdrop ? (
            <Image
              source={{ uri: backdrop }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={palette}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {icon && (
            <Image
              source={{ uri: icon }}
              style={styles.backdropIcon}
              contentFit="contain"
            />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.65)"]}
            style={styles.backdropFade}
          />
        </View>

        <View style={styles.headerBody}>
          <Text style={styles.hubTitle}>{hub.name}</Text>
          {metaParts.length > 0 && (
            <View style={styles.metaRow}>
              {metaParts.map((part, i) => (
                <View key={part + i} style={styles.metaChunk}>
                  <Text style={styles.metaText}>{part}</Text>
                  {i < metaParts.length - 1 && (
                    <Text style={styles.metaDot}>·</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Follow + Bookmark */}
          <View style={styles.actionsRow}>
            {followed ? (
              <Pressable
                onPress={toggleFollow}
                disabled={followPending}
                style={[
                  styles.followingBtn,
                  { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                <Check width={16} height={16} color={colors.text} />
                <Text style={[styles.followingBtnText, { color: colors.text }]}>
                  Following
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={toggleFollow}
                disabled={followPending}
                style={styles.followBtn}
              >
                <LinearGradient
                  colors={[colors.accentPink, colors.accentPurple, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.followBtnGradient}
                >
                  <Plus width={18} height={18} color="#fff" />
                  <Text style={styles.followBtnText}>Follow Hub</Text>
                </LinearGradient>
              </Pressable>
            )}
            <Pressable style={styles.bookmarkBtn} hitSlop={8}>
              <Bookmark width={20} height={20} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.followersText}>
            {formatCount(hub.followersCount)} followers
          </Text>

          {hub.description ? (
            <Text style={styles.description}>{hub.description}</Text>
          ) : null}

          {/* Sort tabs */}
          <View style={styles.tabRow}>
            {(["trending", "new", "top"] as const).map((mode) => {
              const active = sort === mode;
              const label = mode === "trending" ? "Trending" : mode === "new" ? "New" : "Top";
              return (
                <Pressable
                  key={mode}
                  onPress={() => onChangeSort(mode)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        {renderHeaderTop}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accentPink} />
        </View>
      </View>
    );
  }

  if (error || !hub) {
    return (
      <View style={styles.screen}>
        {renderHeaderTop}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load this hub</Text>
          {error && (
            <Text style={styles.errorBody} selectable>
              {error}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {renderHeaderTop}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={renderHubHeader}
        renderItem={({ item }) => (
          <HubPostCard
            post={item}
            onPress={() => router.push(`/post/${item.id}`)}
            onLike={() => likePost(item.id)}
            onPressAuthor={() =>
              item.author?.id && router.push(`/user/${item.author.id}`)
            }
            styles={styles}
            colors={colors}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
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
        ListFooterComponent={
          postsLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.accentPink}
              style={{ marginVertical: 32 }}
            />
          ) : loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.accentPink}
              style={{ marginVertical: 20 }}
            />
          ) : posts.length === 0 && postsError ? (
            <View style={{ paddingVertical: 24, paddingHorizontal: 16, gap: 6 }}>
              <Text style={styles.errorTitle}>Could not load posts</Text>
              <Text style={styles.errorBody} selectable>
                {postsError}
              </Text>
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.endText}>You're all caught up!</Text>
          ) : posts.length === 0 ? (
            <Text style={styles.emptyText}>No posts in this hub yet.</Text>
          ) : null
        }
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },

    // Top bar
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 12,
      backgroundColor: c.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    topBarTitle: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, textAlign: "center" },

    // Backdrop
    backdropWrap: {
      width: "100%",
      height: 220,
      backgroundColor: "#222",
      overflow: "hidden",
    },
    backdropIcon: {
      width: 110,
      height: 110,
      alignSelf: "center",
      marginTop: 50,
    },
    backdropFade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 90,
    },

    // Header body
    headerBody: { padding: 16, gap: 12 },
    hubTitle: { fontSize: 28, fontWeight: "800", color: c.text },
    metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
    metaChunk: { flexDirection: "row", alignItems: "center" },
    metaText: { fontSize: 13, color: c.muted },
    metaDot: { fontSize: 13, color: c.muted, marginHorizontal: 6 },

    actionsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
    followBtn: { flex: 1, borderRadius: 999, overflow: "hidden" },
    followBtnGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
    },
    followBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    followingBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    followingBtnText: { fontWeight: "700", fontSize: 16 },
    bookmarkBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
    },

    followersText: { fontSize: 13, color: c.muted },
    description: { fontSize: 14, color: c.text, lineHeight: 22 },

    tabRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
    },
    tabActive: {
      borderColor: c.accent,
      backgroundColor: "rgba(0,201,177,0.10)",
    },
    tabText: { fontSize: 14, fontWeight: "600", color: c.muted },
    tabTextActive: { color: c.accent },

    // Posts list
    listContent: { paddingHorizontal: 12, gap: 12, paddingTop: 0 },

    postCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      gap: 8,
    },
    postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 32, height: 32, borderRadius: 16 },
    avatarCenter: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 13 },
    userRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
    username: { fontSize: 13, fontWeight: "600", color: c.text },
    dot: { fontSize: 12, color: c.muted },
    time: { fontSize: 12, color: c.muted },

    postTitle: { fontSize: 16, fontWeight: "700", color: c.text, lineHeight: 22 },
    postBody: { fontSize: 14, color: c.muted, lineHeight: 20 },

    postActions: {
      flexDirection: "row",
      gap: 18,
      marginTop: 4,
    },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionCount: { fontSize: 13, color: c.muted },

    // Loading / error / empty
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 8,
    },
    errorTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    errorBody: { fontSize: 13, color: c.muted, textAlign: "center" },
    endText: {
      textAlign: "center",
      color: c.muted,
      fontSize: 13,
      paddingVertical: 20,
    },
    emptyText: {
      textAlign: "center",
      color: c.muted,
      fontSize: 14,
      paddingVertical: 32,
    },
  });
}
