import { useCallback, useEffect, useMemo, useState } from "react";
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
  Heart,
  List,
  MessageCircle,
  Pencil,
  Settings,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { brandLinearGradient } from "@/constants/theme";
import type { AppColors } from "@/constants/theme";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/storage";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  profilePictureUrl: string | null;
  postCount: number;
  followerCount: number;
  followingCount: number;
}

interface ProfilePost {
  id: string;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  hub: { id: string; name: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
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

const LIMIT = 20;

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "watchlist">("posts");

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfile>("/users/me");
      setProfile(data);
    } catch {
      const stored = getStoredUser();
      if (stored) {
        setProfile({
          id: stored.id,
          name: stored.name,
          username: stored.username,
          bio: stored.bio,
          profilePictureUrl: stored.profilePictureUrl,
          postCount: 0,
          followerCount: 0,
          followingCount: 0,
        });
      }
    }
  }, []);

  const fetchPosts = useCallback(
    async (offset = 0, append = false) => {
      if (!profile) return;
      try {
        const data = await api.get<{ posts: ProfilePost[]; total: number }>(
          `/users/${profile.id}/posts?limit=${LIMIT}&offset=${offset}`
        );
        setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
        setTotal(data.total);
      } catch {
        if (!append) setPosts([]);
      }
    },
    [profile]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchProfile();
      setLoading(false);
    })();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) fetchPosts(0);
  }, [profile, fetchPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    if (profile) await fetchPosts(0);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (loadingMore || posts.length >= total) return;
    setLoadingMore(true);
    await fetchPosts(posts.length, true);
    setLoadingMore(false);
  };

  // ── Post card ──────────────────────────────────────────────────────────────

  const renderPost = useCallback(
    ({ item }: { item: ProfilePost }) => (
      <Pressable
        style={styles.postCard}
        onPress={() => router.push(`/post/${item.id}` as never)}
      >
        {item.hub && (
          <Text style={styles.hubName}>{item.hub.name}</Text>
        )}
        <Text style={styles.postTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.postContent} numberOfLines={2}>
          {item.content}
        </Text>
        <View style={styles.postMeta}>
          <View style={styles.metaGroup}>
            <Heart size={14} color={colors.muted} />
            <Text style={styles.metaText}>{formatCount(item.likeCount)}</Text>
          </View>
          <View style={styles.metaGroup}>
            <MessageCircle size={14} color={colors.muted} />
            <Text style={styles.metaText}>
              {formatCount(item.commentCount)}
            </Text>
          </View>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{relativeTime(item.createdAt)}</Text>
        </View>
      </Pressable>
    ),
    [styles, colors, router]
  );

  // ── Header (rendered above the list) ───────────────────────────────────────

  const ListHeader = useMemo(() => {
    if (!profile) return null;
    const initials = profile.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

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
              {profile.profilePictureUrl ? (
                <Image
                  source={{ uri: profile.profilePictureUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Name + Username */}
        <Text style={styles.displayName}>{profile.name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {/* Bio */}
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCount(profile.postCount)}
            </Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCount(profile.followerCount)}
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

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Pencil size={15} color={colors.text} />
            <Text style={styles.actionText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.push("/lists" as never)}
          >
            <List size={15} color={colors.text} />
            <Text style={styles.actionText}>My Lists</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("posts")}
            style={[
              styles.tab,
              activeTab === "posts" && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "posts" && styles.tabTextActive,
              ]}
            >
              Posts
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("watchlist")}
            style={[
              styles.tab,
              activeTab === "watchlist" && styles.tabActive,
            ]}
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
  }, [profile, styles, colors, activeTab, router]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
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
        <FlatList
          data={[]}
          keyExtractor={() => ""}
          renderItem={() => null}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                Your watchlist is empty
              </Text>
              <Text style={[styles.emptyText, { fontSize: 14, marginTop: 4 }]}>
                Save movies and shows to watch later
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    center: { justifyContent: "center", alignItems: "center" },

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
    avatarInitials: {
      fontSize: 34,
      fontWeight: "700",
      color: c.muted,
    },

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

    // Action buttons
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

    // Post cards
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
    postMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: { fontSize: 13, color: c.muted },
    metaDot: { fontSize: 13, color: c.muted },

    // Empty
    emptyWrap: { alignItems: "center", paddingVertical: 40 },
    emptyText: { fontSize: 16, color: c.muted },
  });
}
