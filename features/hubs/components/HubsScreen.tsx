import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { Check, Plus, Search, TrendingUp } from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api, mediaUrl } from "@/lib/api";
import type { AppColors } from "@/constants/theme";
import type {
  FollowedHubsResponse,
  Hub,
  HubListResponse,
  SearchHubsResponse,
} from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(v);
}

/** Stable hue per hub id so empty backdrops aren't all the same colour. */
function gradientFor(seed: string): readonly [string, string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const h = Math.abs(hash);
  const palettes: readonly (readonly [string, string, string])[] = [
    ["#ff7a8a", "#c8a2c8", "#7ed8c4"],
    ["#ff6b6b", "#ffa07a", "#7ed8c4"],
    ["#a18cd1", "#fbc2eb", "#7ed8c4"],
    ["#ff9a9e", "#fad0c4", "#a1c4fd"],
    ["#f6d365", "#fda085", "#fbc2eb"],
    ["#84fab0", "#8fd3f4", "#a18cd1"],
  ];
  return palettes[h % palettes.length];
}

// ── Hub artwork (icon + backdrop) ────────────────────────────────────────────

function HubArtwork({
  hub,
  size,
  rounded,
}: {
  hub: Hub;
  size: number;
  rounded: number;
}) {
  const backdropSrc = mediaUrl(hub.backdropUrl);
  const iconSrc = mediaUrl(hub.iconUrl);
  const palette = gradientFor(hub.id);
  const dim = { width: size, height: size, borderRadius: rounded };

  return (
    <View style={[dim, styleSheets.artworkRoot]}>
      {backdropSrc ? (
        <Image
          source={{ uri: backdropSrc }}
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
      {iconSrc ? (
        <Image
          source={{ uri: iconSrc }}
          style={{ width: size * 0.45, height: size * 0.45 }}
          contentFit="contain"
        />
      ) : (
        <Text style={[styleSheets.artworkInitial, { fontSize: size * 0.4 }]}>
          {(hub.name || "?").charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

// ── Reusable buttons ─────────────────────────────────────────────────────────

function FollowButton({
  followed,
  onPress,
  pending,
  fullWidth,
  colors,
}: {
  followed: boolean;
  onPress: () => void;
  pending: boolean;
  fullWidth?: boolean;
  colors: AppColors;
}) {
  if (followed) {
    return (
      <Pressable
        onPress={onPress}
        disabled={pending}
        style={[
          styleSheets.followingBtn,
          fullWidth && styleSheets.followingBtnFull,
          { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.08)" },
        ]}
      >
        <Check
          width={fullWidth ? 16 : 12}
          height={fullWidth ? 16 : 12}
          color={colors.text}
        />
        <Text
          style={[
            styleSheets.followingText,
            fullWidth && styleSheets.followingTextFull,
            { color: colors.text },
          ]}
        >
          Following
        </Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={[
        styleSheets.followBtn,
        fullWidth && styleSheets.followBtnFull,
      ]}
    >
      <LinearGradient
        colors={[colors.accentPink, colors.accentPurple, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styleSheets.followBtnGradient,
          !fullWidth && styleSheets.followBtnGradientCompact,
        ]}
      >
        <Plus width={fullWidth ? 18 : 12} height={fullWidth ? 18 : 12} color="#fff" />
        <Text
          style={[
            styleSheets.followBtnText,
            !fullWidth && styleSheets.followBtnTextCompact,
          ]}
        >
          Follow
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function HubsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [trending, setTrending] = useState<Hub[]>([]);
  const [followed, setFollowed] = useState<Hub[]>([]);
  const [suggested, setSuggested] = useState<Hub[]>([]);
  const [searchResults, setSearchResults] = useState<Hub[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-hub follow toggle in flight (to prevent double taps)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const [trend, foll, top] = await Promise.all([
        api.get<HubListResponse>("/hubs?sort=trending&limit=10"),
        api.get<FollowedHubsResponse>("/hubs/followed"),
        api.get<HubListResponse>("/hubs?sort=top&limit=20"),
      ]);
      const followedIds = new Set((foll.hubs ?? []).map((h) => h.id));
      setTrending((trend.hubs ?? []).slice(0, 3));
      setFollowed(foll.hubs ?? []);
      setSuggested(
        (top.hubs ?? [])
          .filter((h) => !followedIds.has(h.id))
          .slice(0, 8),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load hubs.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ── Search (debounced) ─────────────────────────────────────────────────────

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.get<SearchHubsResponse>(
          `/hubs/search?q=${encodeURIComponent(trimmed)}&limit=20`,
        );
        if (!cancelled) setSearchResults(data.hubs ?? []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const isFollowed = useCallback(
    (id: string) => followed.some((h) => h.id === id),
    [followed],
  );

  const toggleFollow = useCallback(
    async (hub: Hub) => {
      if (pendingIds.has(hub.id)) return;
      setPendingIds((prev) => new Set(prev).add(hub.id));

      const wasFollowed = isFollowed(hub.id);

      // Optimistic local state
      if (wasFollowed) {
        setFollowed((prev) => prev.filter((h) => h.id !== hub.id));
        // Move it back into suggestions visually so the user can re-follow
        setSuggested((prev) =>
          prev.some((h) => h.id === hub.id) ? prev : [hub, ...prev],
        );
      } else {
        setFollowed((prev) =>
          prev.some((h) => h.id === hub.id) ? prev : [{ ...hub }, ...prev],
        );
        setSuggested((prev) => prev.filter((h) => h.id !== hub.id));
      }

      try {
        const res = await api.post<{ followed: boolean; followersCount?: number }>(
          `/hubs/${hub.id}/follow`,
          {},
        );
        // Reconcile follower count where we have it
        const updateCount = (h: Hub): Hub =>
          h.id === hub.id && typeof res.followersCount === "number"
            ? { ...h, followersCount: res.followersCount }
            : h;
        setTrending((prev) => prev.map(updateCount));
        setSuggested((prev) => prev.map(updateCount));
        setFollowed((prev) => prev.map(updateCount));
        if (searchResults)
          setSearchResults(searchResults.map(updateCount));
      } catch {
        // Revert
        if (wasFollowed) {
          setFollowed((prev) =>
            prev.some((h) => h.id === hub.id) ? prev : [hub, ...prev],
          );
          setSuggested((prev) => prev.filter((h) => h.id !== hub.id));
        } else {
          setFollowed((prev) => prev.filter((h) => h.id !== hub.id));
          setSuggested((prev) =>
            prev.some((h) => h.id === hub.id) ? prev : [hub, ...prev],
          );
        }
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(hub.id);
          return next;
        });
      }
    },
    [pendingIds, isFollowed, searchResults],
  );

  // ── Card renderers ─────────────────────────────────────────────────────────

  const goToHub = (id: string) => router.push(`/hub/${id}`);

  /**
   * Trending card — large rounded artwork on the left, name + meta on the
   * right, full-width gradient Follow button stacked underneath.
   */
  const renderTrendingCard = (hub: Hub) => (
    <Pressable
      key={hub.id}
      onPress={() => goToHub(hub.id)}
      style={styles.trendingCard}
    >
      <HubArtwork hub={hub} size={60} rounded={14} />
      <View style={styles.trendingMeta}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {hub.name}
        </Text>
        <View style={styles.metaRow}>
          {hub.year != null && (
            <>
              <Text style={styles.metaText}>{hub.year}</Text>
              <Text style={styles.metaDot}>·</Text>
            </>
          )}
          <Text style={styles.metaText}>
            {formatCount(hub.followersCount)} followers
          </Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>
            {formatCount(hub.postsCount)} posts
          </Text>
        </View>
        <View style={styles.trendingFollowSpacer}>
          <FollowButton
            followed={isFollowed(hub.id)}
            onPress={() => toggleFollow(hub)}
            pending={pendingIds.has(hub.id)}
            fullWidth
            colors={colors}
          />
        </View>
      </View>
    </Pressable>
  );

  /**
   * Following grid card — large square artwork, name + year/posts beneath.
   * No follow button (already followed).
   */
  const renderFollowingCard = ({ item: hub }: { item: Hub }) => (
    <Pressable
      onPress={() => goToHub(hub.id)}
      style={styles.followingCard}
    >
      <HubArtwork hub={hub} size={150} rounded={16} />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {hub.name}
      </Text>
      <View style={styles.metaRow}>
        {hub.year != null && (
          <>
            <Text style={styles.metaText}>{hub.year}</Text>
            <Text style={styles.metaDot}>·</Text>
          </>
        )}
        <Text style={styles.metaText}>
          {formatCount(hub.postsCount)} posts
        </Text>
      </View>
    </Pressable>
  );

  /**
   * Suggested row — square artwork, name + meta, compact follow on the right.
   */
  const renderSuggestedCard = (hub: Hub) => (
    <Pressable
      key={hub.id}
      onPress={() => goToHub(hub.id)}
      style={styles.suggestedCard}
    >
      <HubArtwork hub={hub} size={56} rounded={12} />
      <View style={styles.suggestedMeta}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {hub.name}
        </Text>
        <View style={styles.metaRow}>
          {hub.year != null && (
            <>
              <Text style={styles.metaText}>{hub.year}</Text>
              <Text style={styles.metaDot}>·</Text>
            </>
          )}
          <Text style={styles.metaText}>
            {formatCount(hub.followersCount)} followers
          </Text>
        </View>
      </View>
      <FollowButton
        followed={isFollowed(hub.id)}
        onPress={() => toggleFollow(hub)}
        pending={pendingIds.has(hub.id)}
        colors={colors}
      />
    </Pressable>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Title Hubs</Text>
      <View style={styles.searchWrap}>
        <Search width={18} height={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies and shows..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
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

  if (error) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load hubs</Text>
          <Text style={styles.errorBody} selectable>
            {error}
          </Text>
        </View>
      </View>
    );
  }

  // ── Search mode: replace the page content with results ──
  if (searchResults !== null) {
    return (
      <View style={styles.screen}>
        {header}
        {searching ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>No hubs match "{query}"</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={styles.list}>
              {searchResults.map(renderSuggestedCard)}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Default mode: trending + following grid + suggested ──
  return (
    <View style={styles.screen}>
      {header}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
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
      >
        {trending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <TrendingUp width={18} height={18} color={colors.accentPink} />
              <Text style={styles.sectionTitle}>Trending Now</Text>
            </View>
            <View style={styles.list}>
              {trending.map(renderTrendingCard)}
            </View>
          </View>
        )}

        {followed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Following ({followed.length})</Text>
            <FlatList
              data={followed}
              keyExtractor={(h) => h.id}
              renderItem={renderFollowingCard}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.grid}
              scrollEnabled={false}
            />
          </View>
        )}

        {suggested.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggested for You</Text>
            <View style={styles.list}>
              {suggested.map(renderSuggestedCard)}
            </View>
          </View>
        )}

        {trending.length === 0 && followed.length === 0 && suggested.length === 0 && (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>Nothing here yet</Text>
            <Text style={styles.errorBody}>
              The hub catalog is empty. Try seeding the API.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Shared (id-independent) styles for HubArtwork / FollowButton ─────────────

const styleSheets = StyleSheet.create({
  artworkRoot: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  artworkInitial: { color: "rgba(255,255,255,0.95)", fontWeight: "700" },

  followBtn: { borderRadius: 999, overflow: "hidden", alignSelf: "flex-start" },
  followBtnFull: { width: "100%", alignSelf: "stretch", borderRadius: 10 },
  followBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  followBtnGradientCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  followBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  followBtnTextCompact: { fontSize: 12 },

  followingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  followingBtnFull: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  followingText: { fontWeight: "600", fontSize: 13 },
  followingTextFull: { fontSize: 16 },
});

// ── Theme-dependent styles ───────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },

    // Header
    header: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.background,
      gap: 12,
    },
    headerTitle: { fontSize: 22, fontWeight: "800", color: c.text },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      padding: 0,
    },

    scrollContent: { paddingTop: 8, gap: 24 },

    section: { gap: 12, paddingHorizontal: 12 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: c.text },

    list: { gap: 12 },

    // Trending card
    trendingCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
    },
    trendingMeta: { flex: 1, gap: 6 },
    trendingFollowSpacer: { marginTop: 20 },

    // Suggested card
    suggestedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
    },
    suggestedMeta: { flex: 1, gap: 4 },

    // Following grid
    grid: { gap: 12 },
    gridRow: { gap: 12 },
    followingCard: {
      flex: 1,
      gap: 6,
    },

    cardTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
    metaText: { fontSize: 12, color: c.muted },
    metaDot: { fontSize: 12, color: c.muted },

    // Error / loading
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
