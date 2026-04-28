import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Heart,
  List as ListIcon,
  MessageCircle,
  Pencil,
  Settings,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { brandLinearGradient } from "@/constants/theme";
import type { AppColors } from "@/constants/theme";
import { api, mediaUrl } from "@/lib/api";
import { getStoredUser } from "@/lib/storage";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  postCount: number;
  createdAt: string;
}

interface ProfilePost {
  id: string;
  title: string | null;
  body: string;
  mediaType: "none" | "image" | "video";
  imageUrl: string | null;
  videoUrl: string | null;
  hasSpoiler: boolean;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  createdAt: string;
  hub: { id: string; name: string; iconUrl: string | null } | null;
}

interface ProfileList {
  id: string;
  userId: string;
  listType: "watchlist" | "watched" | "favorites" | "custom";
  name: string;
  emoji: string | null;
  itemsCount: number;
}

interface ListItem {
  listId: string;
  hubId: string;
  status: "watching" | "watch_next" | null;
  addedAt: string;
  hub: {
    id: string;
    name: string;
    year: number | null;
    iconUrl: string | null;
    backdropUrl: string | null;
  };
}

type WatchFilter = "all" | "watching" | "watched" | "watch_next";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

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

const PAGE_SIZE = 20;

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Profile + posts
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const postsCursorRef = useRef<string | null>(null);
  const postsInFlightRef = useRef(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  // Watchlist
  const [lists, setLists] = useState<ProfileList[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<ListItem[]>([]);
  const [watchedItems, setWatchedItems] = useState<ListItem[]>([]);
  const [favoriteHubIds, setFavoriteHubIds] = useState<Set<string>>(new Set());
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchFilter, setWatchFilter] = useState<WatchFilter>("all");
  // Fallback for Watch Next when the user has no items with that status —
  // populated from the top 20 posts on the For You feed (deduped by hub).
  const [watchNextFallback, setWatchNextFallback] = useState<ListItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "watchlist">("posts");

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfile>("/users/me");
      setProfile(data);
      return data;
    } catch {
      const stored = getStoredUser();
      if (stored) {
        const fallback: UserProfile = {
          id: stored.id,
          email: stored.email,
          username: stored.username,
          displayName: stored.name,
          bio: stored.bio,
          avatarUrl: stored.profilePictureUrl,
          followersCount: 0,
          followingCount: 0,
          postCount: 0,
          createdAt: stored.createdAt,
        };
        setProfile(fallback);
        return fallback;
      }
      return null;
    }
  }, []);

  const fetchPosts = useCallback(
    async (userId: string, cursor: string | null, reset: boolean) => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const data = await api.get<{
          posts: ProfilePost[];
          nextCursor: string | null;
          hasNextPage: boolean;
        }>(`/users/${userId}/posts?${params.toString()}`);
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
        postsCursorRef.current = data.nextCursor ?? null;
        setHasMorePosts(!!data.hasNextPage && !!data.nextCursor);
      } catch {
        if (reset) setPosts([]);
      }
    },
    [],
  );

  const fetchAllListItems = useCallback(async (listId: string) => {
    const acc: ListItem[] = [];
    let cursor: string | null = null;
    // Walk pages — list sizes are small in the MVP.
    // Cap at 5 pages to avoid pathological loops.
    for (let i = 0; i < 5; i++) {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const data = await api.get<{
        items: ListItem[];
        nextCursor: string | null;
        hasNextPage: boolean;
      }>(`/lists/${listId}/items?${params.toString()}`);
      acc.push(...(data.items ?? []));
      if (!data.hasNextPage || !data.nextCursor) break;
      cursor = data.nextCursor;
    }
    return acc;
  }, []);

  const fetchWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    try {
      const data = await api.get<{ defaults: ProfileList[]; custom: ProfileList[] }>(
        "/lists",
      );
      const defaults = data.defaults ?? [];
      setLists([...defaults, ...(data.custom ?? [])]);

      const watchlistList = defaults.find((l) => l.listType === "watchlist");
      const watchedList = defaults.find((l) => l.listType === "watched");
      const favoritesList = defaults.find((l) => l.listType === "favorites");

      const [w, d, f] = await Promise.all([
        watchlistList ? fetchAllListItems(watchlistList.id) : Promise.resolve([]),
        watchedList ? fetchAllListItems(watchedList.id) : Promise.resolve([]),
        favoritesList ? fetchAllListItems(favoritesList.id) : Promise.resolve([]),
      ]);
      setWatchlistItems(w);
      setWatchedItems(d);
      setFavoriteHubIds(new Set(f.map((i) => i.hubId)));
    } catch {
      setWatchlistItems([]);
      setWatchedItems([]);
      setFavoriteHubIds(new Set());
    } finally {
      setWatchlistLoading(false);
    }
  }, [fetchAllListItems]);

  /**
   * Pulls the top 20 posts from the For You feed and projects each unique hub
   * into a ListItem-shaped suggestion. Used as the Watch Next fallback so a
   * brand-new user with an empty watchlist still sees something to explore.
   *
   * The feed's HubSummary only carries iconUrl (a poster), so we re-hydrate
   * each hub via /hubs/:id in parallel to get the proper landscape backdrop
   * — otherwise tiles fall back to the gradient and don't match the Watched
   * tab's full-bleed look.
   */
  const fetchWatchNextFallback = useCallback(async () => {
    try {
      const data = await api.get<{
        posts: {
          id: string;
          createdAt: string;
          hub: { id: string; name: string } | null;
        }[];
      }>("/posts/feed?limit=20");

      // Preserve feed order, dedupe by hub.
      const orderedHubIds: string[] = [];
      const addedAtById = new Map<string, string>();
      const seen = new Set<string>();
      for (const p of data.posts ?? []) {
        const h = p.hub;
        if (!h?.id || seen.has(h.id)) continue;
        seen.add(h.id);
        orderedHubIds.push(h.id);
        addedAtById.set(h.id, p.createdAt);
      }

      const results = await Promise.allSettled(
        orderedHubIds.map((id) =>
          api.get<{
            id: string;
            name: string;
            year: number | null;
            iconUrl: string | null;
            backdropUrl: string | null;
          }>(`/hubs/${id}`),
        ),
      );

      const items: ListItem[] = [];
      results.forEach((r, idx) => {
        if (r.status !== "fulfilled") return;
        const hub = r.value;
        items.push({
          listId: "",
          hubId: hub.id,
          status: "watch_next",
          addedAt: addedAtById.get(orderedHubIds[idx]) ?? new Date().toISOString(),
          hub: {
            id: hub.id,
            name: hub.name,
            year: hub.year,
            iconUrl: hub.iconUrl,
            backdropUrl: hub.backdropUrl,
          },
        });
      });
      setWatchNextFallback(items);
    } catch {
      setWatchNextFallback([]);
    }
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const me = await fetchProfile();
      if (me && !cancelled) {
        postsCursorRef.current = null;
        await fetchPosts(me.id, null, true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProfile, fetchPosts]);

  // Lazy-fetch watchlist the first time the tab is opened
  const watchlistFetchedRef = useRef(false);
  useEffect(() => {
    if (activeTab === "watchlist" && !watchlistFetchedRef.current) {
      watchlistFetchedRef.current = true;
      fetchWatchlist();
      fetchWatchNextFallback();
    }
  }, [activeTab, fetchWatchlist, fetchWatchNextFallback]);

  const onRefresh = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    const me = await fetchProfile();
    if (me) {
      postsCursorRef.current = null;
      await fetchPosts(me.id, null, true);
    }
    if (activeTab === "watchlist") {
      await Promise.all([fetchWatchlist(), fetchWatchNextFallback()]);
    }
    setRefreshing(false);
  }, [profile, fetchProfile, fetchPosts, activeTab, fetchWatchlist, fetchWatchNextFallback]);

  const onEndReached = useCallback(async () => {
    if (
      !profile ||
      postsInFlightRef.current ||
      !hasMorePosts ||
      !postsCursorRef.current
    )
      return;
    postsInFlightRef.current = true;
    setLoadingMorePosts(true);
    try {
      await fetchPosts(profile.id, postsCursorRef.current, false);
    } finally {
      postsInFlightRef.current = false;
      setLoadingMorePosts(false);
    }
  }, [profile, fetchPosts, hasMorePosts]);

  // ── Watchlist filtering ────────────────────────────────────────────────────

  const visibleWatchItems: ListItem[] = useMemo(() => {
    switch (watchFilter) {
      case "watched":
        return watchedItems;
      case "watching":
        return watchlistItems.filter((i) => i.status === "watching");
      case "watch_next": {
        // Watch Next must never be empty — fall back to top hubs from the
        // For You feed when the user hasn't queued anything themselves.
        const own = watchlistItems.filter((i) => i.status === "watch_next");
        return own.length > 0 ? own : watchNextFallback;
      }
      case "all":
      default: {
        // Union watchlist + watched, deduped by hubId.
        const seen = new Set<string>();
        const out: ListItem[] = [];
        for (const it of [...watchlistItems, ...watchedItems]) {
          if (seen.has(it.hubId)) continue;
          seen.add(it.hubId);
          out.push(it);
        }
        return out;
      }
    }
  }, [watchFilter, watchlistItems, watchedItems, watchNextFallback]);

  // ── Render: post card ─────────────────────────────────────────────────────

  const renderPost = useCallback(
    ({ item }: { item: ProfilePost }) => (
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
        <Text style={styles.postContent} numberOfLines={2}>
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
    ),
    [styles, colors, router],
  );

  // ── Render: watchlist tile ────────────────────────────────────────────────

  const renderWatchTile = useCallback(
    (item: ListItem) => {
      const backdrop = mediaUrl(item.hub.backdropUrl);
      const icon = mediaUrl(item.hub.iconUrl);
      const palette = gradientFor(item.hubId);
      const isFavorite = favoriteHubIds.has(item.hubId);
      return (
        <Pressable
          key={item.hubId}
          style={styles.watchTile}
          onPress={() => router.push(`/hub/${item.hubId}` as never)}
        >
          <View style={styles.watchArtwork}>
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
                style={styles.watchIcon}
                contentFit="contain"
              />
            )}
            {isFavorite && (
              <View style={styles.favoriteBadge}>
                <Heart size={14} color="#fff" fill="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.watchTitle} numberOfLines={1}>
            {item.hub.name}
          </Text>
          {item.hub.year != null && (
            <Text style={styles.watchYear}>{item.hub.year}</Text>
          )}
        </Pressable>
      );
    },
    [styles, favoriteHubIds, router],
  );

  // ── Render: profile header ────────────────────────────────────────────────

  const ProfileHeader = useCallback(() => {
    if (!profile) return null;
    const initials = (profile.displayName || profile.username || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const avatar = mediaUrl(profile.avatarUrl);

    return (
      <View>
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

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatCount(profile.postCount)}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatCount(profile.followersCount)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatCount(profile.followingCount)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/edit-profile" as never)}
          >
            <Pencil size={15} color={colors.text} />
            <Text style={styles.actionText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/lists" as never)}
          >
            <ListIcon size={15} color={colors.text} />
            <Text style={styles.actionText}>My Lists</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("posts")}
            style={[styles.tab, activeTab === "posts" && styles.tabActive]}
          >
            <Text
              style={[styles.tabText, activeTab === "posts" && styles.tabTextActive]}
            >
              Posts
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("watchlist")}
            style={[styles.tab, activeTab === "watchlist" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "watchlist" && styles.tabTextActive,
              ]}
            >
              Watchlist
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }, [profile, activeTab, styles, colors, router]);

  // ── Render: watchlist sub-filter row ──────────────────────────────────────

  const watchFilters: { key: WatchFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "watching", label: "Watching" },
    { key: "watched", label: "Watched" },
    { key: "watch_next", label: "Watch Next" },
  ];

  const WatchFilters = (
    <View style={styles.filterRow}>
      {watchFilters.map((f) => {
        const active = watchFilter === f.key;
        return (
          <Pressable
            key={f.key}
            onPress={() => setWatchFilter(f.key)}
            style={[styles.filterChip, active && styles.filterChipActive]}
          >
            <Text
              style={[styles.filterChipText, active && styles.filterChipTextActive]}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // ── Loading / empty ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Fixed header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          onPress={() => router.push("/(app)/(tabs)/settings" as never)}
          hitSlop={10}
        >
          <Settings size={22} color={colors.text} />
        </Pressable>
      </View>

      {activeTab === "posts" ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={ProfileHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          }
          ListFooterComponent={
            loadingMorePosts ? (
              <ActivityIndicator
                style={{ paddingVertical: 20 }}
                color={colors.accent}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          <ProfileHeader />
          {WatchFilters}
          {watchlistLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : visibleWatchItems.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Nothing here yet</Text>
              <Text style={[styles.emptyText, { fontSize: 14, marginTop: 4 }]}>
                Save movies and shows to watch later
              </Text>
            </View>
          ) : (
            <View style={styles.watchGrid}>
              {visibleWatchItems.map(renderWatchTile)}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    center: { justifyContent: "center", alignItems: "center", padding: 20 },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 22, fontWeight: "700", color: c.text },

    // Avatar
    avatarSection: { alignItems: "center", marginTop: 24, marginBottom: 16 },
    avatarRing: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInner: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: 92, height: 92, borderRadius: 46 },
    avatarInitials: { fontSize: 34, fontWeight: "700", color: c.muted },

    // Identity
    displayName: {
      fontSize: 22,
      fontWeight: "700",
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
      marginTop: 8,
      marginHorizontal: 40,
      lineHeight: 20,
    },

    // Stats
    statsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 40,
      marginTop: 20,
      marginBottom: 20,
    },
    stat: { alignItems: "center" },
    statValue: { fontSize: 18, fontWeight: "700", color: c.text },
    statLabel: { fontSize: 13, color: c.muted, marginTop: 2 },

    // Actions
    actionRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 12,
      marginBottom: 20,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    actionText: { fontSize: 15, fontWeight: "600", color: c.text },

    // Tabs
    tabRow: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: c.accent },
    tabText: { fontSize: 15, fontWeight: "600", color: c.muted },
    tabTextActive: { color: c.accent },

    // Posts
    postCard: {
      marginHorizontal: 16,
      marginTop: 14,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    hubName: {
      fontSize: 13,
      fontWeight: "600",
      color: c.accent,
      marginBottom: 6,
    },
    postTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
      marginBottom: 6,
      lineHeight: 22,
    },
    postContent: {
      fontSize: 14,
      color: c.muted,
      lineHeight: 20,
      marginBottom: 12,
    },
    postMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 13, color: c.muted },
    metaDot: { fontSize: 13, color: c.muted },

    // Watchlist filter chips
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexWrap: "wrap",
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
    },
    filterChipActive: {
      borderColor: c.accent,
      backgroundColor: "rgba(0,201,177,0.10)",
    },
    filterChipText: { fontSize: 14, fontWeight: "600", color: c.muted },
    filterChipTextActive: { color: c.accent },

    // Watchlist grid
    watchGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      gap: 10,
    },
    watchTile: { width: "31.5%", gap: 6 },
    watchArtwork: {
      width: "100%",
      aspectRatio: 0.75,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "#222",
      alignItems: "center",
      justifyContent: "center",
    },
    watchIcon: { width: "55%", height: "55%" },
    favoriteBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    watchTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    watchYear: { fontSize: 11, color: c.muted },

    // Empty
    emptyWrap: { alignItems: "center", paddingVertical: 40 },
    emptyText: { fontSize: 16, color: c.muted },
  });
}
