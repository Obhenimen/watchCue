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
  Check,
  Heart,
  MessageCircle,
  MoreVertical,
  Plus,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { brandLinearGradient } from "@/constants/theme";
import type { AppColors } from "@/constants/theme";
import { api, mediaUrl } from "@/lib/api";
import { getStoredUser } from "@/lib/storage";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  postCount: number;
  followedByMe?: boolean;
  createdAt: string;
}

interface UserPost {
  id: string;
  title: string | null;
  body: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  hub: { id: string; name: string; iconUrl: string | null } | null;
}

interface PostsResponse {
  posts: UserPost[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(v);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PAGE_SIZE = 10;

// ── Screen ────────────────────────────────────────────────────────────────────

export function UserProfileScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);

  const storedUser = useMemo(() => getStoredUser(), []);
  const isSelf = storedUser?.id === userId;

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfile>(`/users/${userId}`);
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this profile.");
    }
  }, [userId]);

  const loadPosts = useCallback(
    async (cursor: string | null, reset: boolean) => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const data = await api.get<PostsResponse>(
          `/users/${userId}/posts?${params.toString()}`,
        );
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
      } catch {
        if (reset) setPosts([]);
      }
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      cursorRef.current = null;
      await Promise.all([loadProfile(), loadPosts(null, true)]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile, loadPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = null;
    setHasMore(true);
    await Promise.all([loadProfile(), loadPosts(null, true)]);
    setRefreshing(false);
  }, [loadProfile, loadPosts]);

  const onEndReached = useCallback(async () => {
    if (inFlightRef.current || !hasMore || !cursorRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      await loadPosts(cursorRef.current, false);
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [loadPosts, hasMore]);

  // ── Follow toggle ─────────────────────────────────────────────────────────

  const toggleFollow = useCallback(async () => {
    if (!profile || followPending || isSelf) return;
    setFollowPending(true);
    const before = {
      followedByMe: !!profile.followedByMe,
      followersCount: profile.followersCount,
    };
    // Optimistic: the backend returns { followed } but not counts, so we
    // adjust the local count ourselves and rely on refresh to reconcile.
    setProfile({
      ...profile,
      followedByMe: !before.followedByMe,
      followersCount: before.followedByMe
        ? Math.max(0, before.followersCount - 1)
        : before.followersCount + 1,
    });
    try {
      const res = await api.post<{ followed: boolean }>(
        `/users/${profile.id}/follow`,
        {},
      );
      setProfile((p) =>
        p
          ? {
              ...p,
              followedByMe: res.followed,
              // If the server disagrees with our optimistic direction, snap.
              followersCount:
                res.followed === !before.followedByMe
                  ? p.followersCount
                  : before.followersCount,
            }
          : p,
      );
    } catch {
      setProfile((p) => (p ? { ...p, ...before } : p));
    } finally {
      setFollowPending(false);
    }
  }, [profile, followPending, isSelf]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderHeaderBar = (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <Text style={styles.topBarTitle} numberOfLines={1}>
        {profile ? `@${profile.username}` : "Profile"}
      </Text>
      <Pressable hitSlop={10} style={styles.backBtn}>
        <MoreVertical width={22} height={22} color={colors.text} />
      </Pressable>
    </View>
  );

  const renderProfileHeader = () => {
    if (!profile) return null;
    const avatar = mediaUrl(profile.avatarUrl);
    const initials = (profile.displayName || profile.username || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const followed = !!profile.followedByMe;

    return (
      <View style={styles.headerBody}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={brandLinearGradient.colors}
            locations={[...brandLinearGradient.locations]}
            start={brandLinearGradient.start}
            end={brandLinearGradient.end}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              {avatar ? (
                <Image
                  source={{ uri: avatar }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatCount(profile.postCount)}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCount(profile.followersCount)}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCount(profile.followingCount)}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Follow / Following — hidden when viewing your own profile */}
        {!isSelf &&
          (followed ? (
            <Pressable
              onPress={toggleFollow}
              disabled={followPending}
              style={[
                styles.followingBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
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
                <Text style={styles.followBtnText}>Follow</Text>
              </LinearGradient>
            </Pressable>
          ))}

        <Text style={styles.postsSectionTitle}>Posts</Text>
      </View>
    );
  };

  const renderPost = ({ item }: { item: UserPost }) => (
    <Pressable
      style={styles.postCard}
      onPress={() => router.push(`/post/${item.id}` as never)}
    >
      {item.hub && (
        <Pressable
          onPress={() =>
            item.hub?.id && router.push(`/hub/${item.hub.id}` as never)
          }
          hitSlop={4}
        >
          <Text style={styles.hubName} numberOfLines={1}>
            {item.hub.name}
          </Text>
        </Pressable>
      )}
      {item.title ? (
        <Text style={styles.postTitle} numberOfLines={2}>
          {item.title}
        </Text>
      ) : null}
      <Text style={styles.postBody} numberOfLines={2}>
        {item.body}
      </Text>
      <View style={styles.postMeta}>
        <View style={styles.metaGroup}>
          <Heart size={14} color={colors.muted} />
          <Text style={styles.metaText}>{formatCount(item.likesCount)}</Text>
        </View>
        <View style={styles.metaGroup}>
          <MessageCircle size={14} color={colors.muted} />
          <Text style={styles.metaText}>{formatCount(item.commentsCount)}</Text>
        </View>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{relativeTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        {renderHeaderBar}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accentPink} />
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.screen}>
        {renderHeaderBar}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load this profile</Text>
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
      {renderHeaderBar}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={renderProfileHeader}
        renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
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
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.accentPink}
              style={{ marginVertical: 20 }}
            />
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
    topBarTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
    },

    // Profile header body
    headerBody: { padding: 16 },

    avatarSection: { alignItems: "center", marginTop: 12, marginBottom: 12 },
    avatarRing: {
      width: 110,
      height: 110,
      borderRadius: 55,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInner: {
      width: 102,
      height: 102,
      borderRadius: 51,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarInitials: { fontSize: 36, fontWeight: "700", color: c.muted },

    displayName: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    username: {
      fontSize: 15,
      fontWeight: "500",
      color: c.accent,
      textAlign: "center",
      marginTop: 2,
    },
    bio: {
      fontSize: 14,
      color: c.muted,
      textAlign: "center",
      marginTop: 10,
      marginHorizontal: 24,
      lineHeight: 20,
    },

    statsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 40,
      marginTop: 18,
      marginBottom: 16,
    },
    stat: { alignItems: "center" },
    statValue: { fontSize: 18, fontWeight: "700", color: c.text },
    statLabel: { fontSize: 13, color: c.muted, marginTop: 2 },

    // Follow button (not followed yet — gradient)
    followBtn: { width: "100%", borderRadius: 12, overflow: "hidden" },
    followBtnGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
    },
    followBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    // Following button (muted with check)
    followingBtn: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
    },
    followingBtnText: { fontWeight: "700", fontSize: 16 },

    postsSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.muted,
      marginTop: 22,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },

    // Post cards
    postCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      gap: 6,
    },
    hubName: { fontSize: 13, fontWeight: "600", color: c.accent },
    postTitle: { fontSize: 16, fontWeight: "700", color: c.text, lineHeight: 22 },
    postBody: { fontSize: 14, color: c.muted, lineHeight: 20 },
    postMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    metaGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: c.muted },
    metaDot: { fontSize: 12, color: c.muted, marginHorizontal: 2 },

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
    emptyWrap: { alignItems: "center", paddingVertical: 36 },
    emptyText: { fontSize: 14, color: c.muted },
  });
}
