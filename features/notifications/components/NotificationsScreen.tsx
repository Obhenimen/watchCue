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
  Film,
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api, mediaUrl } from "@/lib/api";
import type { AppColors } from "@/constants/theme";

// ── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "post_like"
  | "post_repost"
  | "post_comment"
  | "comment_reply"
  | "comment_like"
  | "user_follow";

interface NotificationItem {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  postId: string | null;
  commentId: string | null;
  hubId: string | null;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  post: { id: string; title: string | null; body: string } | null;
  comment: { id: string; body: string } | null;
  hub: { id: string; name: string; iconUrl: string | null } | null;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

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

function verbFor(type: NotificationType): string {
  switch (type) {
    case "post_like":
      return "liked your post";
    case "post_repost":
      return "reposted your post";
    case "post_comment":
      return "commented on your post";
    case "comment_reply":
      return "replied to your comment";
    case "comment_like":
      return "liked your comment";
    case "user_follow":
      return "started following you";
    default:
      return "sent you an update";
  }
}

function previewFor(n: NotificationItem): string | null {
  switch (n.type) {
    case "post_like":
    case "post_repost":
      return n.post?.title ?? n.post?.body ?? null;
    case "post_comment":
    case "comment_reply":
    case "comment_like":
      return n.comment?.body ?? n.post?.title ?? null;
    case "user_follow":
      return null;
    default:
      return null;
  }
}

const PAGE_SIZE = 20;

// ── Row icon ──────────────────────────────────────────────────────────────────

function TypeIcon({
  type,
  colors,
}: {
  type: NotificationType;
  colors: AppColors;
}) {
  const size = 16;
  switch (type) {
    case "post_like":
    case "comment_like":
      return <Heart width={size} height={size} color={colors.accentPink} />;
    case "post_comment":
    case "comment_reply":
      return (
        <MessageCircle width={size} height={size} color={colors.accent} />
      );
    case "post_repost":
      return <Repeat2 width={size} height={size} color={colors.accentPurple} />;
    case "user_follow":
      return <UserPlus width={size} height={size} color={colors.accentPurple} />;
    default:
      return <Film width={size} height={size} color={colors.accent} />;
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await api.get<{ count: number }>("/notifications/unread-count");
      setUnreadCount(data.count ?? 0);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadPage = useCallback(
    async (cursor: string | null, reset: boolean) => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const data = await api.get<NotificationsResponse>(
          `/notifications?${params.toString()}`,
        );
        const incoming = Array.isArray(data.notifications)
          ? data.notifications
          : [];
        if (reset) {
          setItems(incoming);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((n) => n.id));
            const fresh = incoming.filter((n) => !seen.has(n.id));
            return fresh.length === 0 ? prev : [...prev, ...fresh];
          });
        }
        cursorRef.current = data.nextCursor ?? null;
        setHasMore(!!data.hasNextPage && !!data.nextCursor);
        setError(null);
      } catch (e) {
        if (reset) setItems([]);
        setError(
          e instanceof Error ? e.message : "Could not load notifications.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      cursorRef.current = null;
      await Promise.all([loadPage(null, true), loadUnreadCount()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage, loadUnreadCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = null;
    setHasMore(true);
    await Promise.all([loadPage(null, true), loadUnreadCount()]);
    setRefreshing(false);
  }, [loadPage, loadUnreadCount]);

  const onLoadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore || !cursorRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      await loadPage(cursorRef.current, false);
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [loadPage, hasMore]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    if (markingRead || unreadCount === 0) return;
    setMarkingRead(true);
    // Optimistic
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.post("/notifications/read", {});
    } catch {
      // Best-effort; next refresh will correct.
    } finally {
      setMarkingRead(false);
    }
  }, [markingRead, unreadCount]);

  const handlePress = useCallback(
    (n: NotificationItem) => {
      // Route based on notification type.
      if (n.type === "user_follow" && n.actor?.id) {
        router.push(`/user/${n.actor.id}` as never);
        return;
      }
      if (n.postId) {
        router.push(`/post/${n.postId}` as never);
        return;
      }
      if (n.hubId) {
        router.push(`/hub/${n.hubId}` as never);
        return;
      }
      if (n.actor?.id) router.push(`/user/${n.actor.id}` as never);
    },
    [router],
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderAvatar = (n: NotificationItem) => {
    const resolved = mediaUrl(n.actor?.avatarUrl);
    const initial = (n.actor?.username ?? "?").charAt(0).toUpperCase();
    if (resolved) {
      return (
        <Image source={{ uri: resolved }} style={styles.avatar} contentFit="cover" />
      );
    }
    return (
      <LinearGradient
        colors={[colors.accentPink, colors.accent]}
        style={[styles.avatar, styles.avatarCenter]}
      >
        <Text style={styles.avatarInitial}>{initial}</Text>
      </LinearGradient>
    );
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const preview = previewFor(item);
    const hubForHighlight = item.type === "user_follow" ? null : item.hub;
    return (
      <Pressable onPress={() => handlePress(item)} style={styles.row}>
        {renderAvatar(item)}
        <View style={styles.rowBody}>
          <Text style={styles.rowHeadline} numberOfLines={2}>
            <Text style={styles.username}>@{item.actor?.username ?? "unknown"}</Text>
            <Text style={styles.verb}> {verbFor(item.type)}</Text>
            {hubForHighlight ? (
              <>
                <Text style={styles.verb}> in </Text>
                <Text style={styles.hubLink}>{hubForHighlight.name}</Text>
              </>
            ) : null}
          </Text>
          {preview ? (
            <Text style={styles.preview} numberOfLines={1}>
              &quot;{preview}&quot;
            </Text>
          ) : null}
          <View style={styles.footerRow}>
            <TypeIcon type={item.type} colors={colors} />
            <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
          </View>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <Text style={styles.subtitle}>{unreadCount} unread</Text>
        )}
      </View>
      <Pressable
        onPress={markAllRead}
        disabled={unreadCount === 0 || markingRead}
        hitSlop={6}
      >
        <Text
          style={[
            styles.markAll,
            (unreadCount === 0 || markingRead) && { color: colors.muted },
          ]}
        >
          Mark all as read
        </Text>
      </Pressable>
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

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPink}
            colors={[colors.accentPink]}
          />
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.centered}>
              <Text style={styles.errorTitle}>
                Could not load notifications
              </Text>
              <Text style={styles.errorBody} selectable>
                {error}
              </Text>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptyBody}>
                No notifications yet. Interact with hubs and posts to see
                activity here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.accentPink}
              style={{ marginVertical: 20 }}
            />
          ) : hasMore && items.length > 0 ? (
            <Pressable onPress={onLoadMore} style={styles.loadMoreBtn}>
              <Text style={styles.loadMoreText}>Load more notifications</Text>
            </Pressable>
          ) : !hasMore && items.length > 0 ? (
            <Text style={styles.endText}>You're all caught up!</Text>
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

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.muted, marginTop: 1 },
    markAll: { color: c.accent, fontWeight: "700", fontSize: 13 },

    // Row
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.surface,
    },
    avatarCenter: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 16 },

    rowBody: { flex: 1, gap: 4 },
    rowHeadline: { fontSize: 14, color: c.text, lineHeight: 19 },
    username: { fontWeight: "700", color: c.text },
    verb: { color: c.muted, fontWeight: "500" },
    hubLink: { color: c.accent, fontWeight: "700" },
    preview: { fontSize: 13, color: c.muted, fontStyle: "italic" },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    time: { fontSize: 12, color: c.muted },

    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.accentPink,
      marginTop: 6,
      marginLeft: 4,
    },

    // Footer
    loadMoreBtn: { alignItems: "center", paddingVertical: 20 },
    loadMoreText: { color: c.accent, fontWeight: "700", fontSize: 14 },
    endText: {
      textAlign: "center",
      color: c.muted,
      fontSize: 13,
      paddingVertical: 20,
    },

    // Empty / error
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 6,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    emptyBody: {
      fontSize: 13,
      color: c.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    errorTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    errorBody: { fontSize: 12, color: c.muted, textAlign: "center" },
  });
}
