import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  ArrowLeft,
  Edit2,
  Lock,
  MoreVertical,
  Plus,
  Share2,
  Trash2,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api, mediaUrl } from "@/lib/api";
import type { AppColors } from "@/constants/theme";
import type {
  ListItem,
  ListItemsResponse,
  UserList,
  UserListsResponse,
} from "../types";
import { CreateListSheet } from "./CreateListSheet";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Thumbnail collage (custom list card) ─────────────────────────────────────

function Collage({
  items,
  totalCount,
  size,
}: {
  items: ListItem[];
  totalCount: number;
  size: number;
}) {
  if (items.length === 0) {
    return (
      <LinearGradient
        colors={["#2a2a2a", "#1a1a1a"]}
        style={[{ width: size, height: size }, collageStyles.empty]}
      />
    );
  }

  const tiles = items.slice(0, 4);
  const extras = Math.max(0, totalCount - tiles.length);

  const renderTile = (item: ListItem, key: string) => {
    const src = mediaUrl(item.hub.backdropUrl);
    if (src) {
      return <Image key={key} source={{ uri: src }} style={collageStyles.tile} contentFit="cover" />;
    }
    return (
      <LinearGradient
        key={key}
        colors={gradientFor(item.hubId)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={collageStyles.tile}
      />
    );
  };

  if (tiles.length === 1) {
    return (
      <View style={[collageStyles.root, { width: size, height: size }]}>
        {renderTile(tiles[0], tiles[0].hubId)}
      </View>
    );
  }

  // 2-tile vertical split, 3-tile one-over-two, 4-tile 2x2 — keeps the design
  // simple without extra libraries.
  return (
    <View style={[collageStyles.root, { width: size, height: size }]}>
      <View style={collageStyles.col}>
        {renderTile(tiles[0], tiles[0].hubId)}
        {tiles[2] && renderTile(tiles[2], tiles[2].hubId)}
      </View>
      <View style={collageStyles.col}>
        {tiles[1] && renderTile(tiles[1], tiles[1].hubId)}
        {tiles[3] && renderTile(tiles[3], tiles[3].hubId)}
      </View>
      {extras > 0 && (
        <View style={collageStyles.overlay}>
          <Text style={collageStyles.overlayText}>+{extras}</Text>
        </View>
      )}
    </View>
  );
}

const collageStyles = StyleSheet.create({
  root: {
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
  },
  col: { flex: 1, flexDirection: "column" },
  tile: { flex: 1, width: "100%", backgroundColor: "#1a1a1a" },
  empty: { borderRadius: 12 },
  overlay: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  overlayText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function MyListsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [defaults, setDefaults] = useState<UserList[]>([]);
  const [custom, setCustom] = useState<UserList[]>([]);
  // Up to 5 preview items per custom list (for the collage)
  const [previews, setPreviews] = useState<Record<string, ListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<UserListsResponse>("/lists");
      const d = data.defaults ?? [];
      const c = data.custom ?? [];
      setDefaults(d);
      setCustom(c);
      setError(null);

      // Fetch 5-item previews for each custom list with content — used for
      // the thumbnail collage. N+1 but custom lists are few in practice.
      const previewEntries = await Promise.all(
        c.map(async (list): Promise<[string, ListItem[]]> => {
          if (list.itemsCount === 0) return [list.id, []];
          try {
            const res = await api.get<ListItemsResponse>(
              `/lists/${list.id}/items?limit=5`,
            );
            return [list.id, res.items ?? []];
          } catch {
            return [list.id, []];
          }
        }),
      );
      setPreviews(Object.fromEntries(previewEntries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your lists.");
    }
  }, []);

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

  // ── Actions ────────────────────────────────────────────────────────────────

  const onCreated = useCallback((list: UserList) => {
    setCustom((prev) => [list, ...prev]);
    setPreviews((prev) => ({ ...prev, [list.id]: [] }));
  }, []);

  const deleteList = useCallback(
    (list: UserList) => {
      setMenuForId(null);
      Alert.alert(
        "Delete list?",
        `"${list.name}" will be permanently deleted. This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeletingId(list.id);
              try {
                await api.delete(`/lists/${list.id}`);
                setCustom((prev) => prev.filter((l) => l.id !== list.id));
                setPreviews((prev) => {
                  const next = { ...prev };
                  delete next[list.id];
                  return next;
                });
              } catch (e) {
                Alert.alert(
                  "Couldn't delete",
                  e instanceof Error ? e.message : "Try again later.",
                );
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderDefaultCard = (list: UserList) => (
    <Pressable key={list.id} style={styles.defaultCard}>
      <Text style={styles.defaultEmoji}>{list.emoji ?? "📋"}</Text>
      <Text style={styles.defaultName}>{list.name}</Text>
      <Text style={styles.defaultCount}>
        {list.itemsCount} {list.itemsCount === 1 ? "item" : "items"}
      </Text>
    </Pressable>
  );

  const renderCustomCard = (list: UserList) => {
    const items = previews[list.id] ?? [];
    const isDeleting = deletingId === list.id;
    return (
      <View key={list.id} style={[styles.customCard, isDeleting && { opacity: 0.5 }]}>
        <Collage items={items} totalCount={list.itemsCount} size={92} />
        <View style={styles.customMeta}>
          <View style={styles.customTitleRow}>
            <Text style={styles.customTitle} numberOfLines={1}>
              {list.emoji ? `${list.emoji} ` : ""}
              {list.name}
            </Text>
            <Pressable
              onPress={() =>
                setMenuForId((v) => (v === list.id ? null : list.id))
              }
              hitSlop={10}
              style={styles.menuBtn}
            >
              <MoreVertical width={18} height={18} color={colors.muted} />
            </Pressable>
          </View>
          {list.description ? (
            <Text style={styles.customDesc} numberOfLines={2}>
              {list.description}
            </Text>
          ) : null}
          <View style={styles.customFooter}>
            <Text style={styles.customCount}>
              {list.itemsCount} {list.itemsCount === 1 ? "item" : "items"}
            </Text>
            {!list.isPublic && (
              <>
                <Text style={styles.customDot}>·</Text>
                <View style={styles.privateBadge}>
                  <Lock width={11} height={11} color={colors.muted} />
                  <Text style={styles.customCount}>Private</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.backBtn}
      >
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>My Lists</Text>
      <Pressable
        onPress={() => setCreateOpen(true)}
        hitSlop={8}
        style={styles.createBtn}
      >
        <LinearGradient
          colors={[colors.accentPink, colors.accentPurple, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createBtnGradient}
        >
          <Plus width={14} height={14} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </LinearGradient>
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
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
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} selectable>
              {error}
            </Text>
          </View>
        )}

        {/* Default Lists */}
        {defaults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Lists</Text>
            <View style={styles.defaultGrid}>
              {defaults.map(renderDefaultCard)}
            </View>
          </View>
        )}

        {/* Custom Lists */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Lists</Text>
          {custom.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No custom lists yet</Text>
              <Text style={styles.emptyBody}>
                Tap Create to group hubs any way you like.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>{custom.map(renderCustomCard)}</View>
          )}
        </View>
      </ScrollView>

      {/* Context menu — simple modal with three actions (Share/Edit stubbed) */}
      <Modal
        visible={menuForId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuForId(null)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuForId(null)}
        >
          <Pressable style={styles.menuCard}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuForId(null);
                Alert.alert(
                  "Share List",
                  "Sharing isn't wired up yet.",
                );
              }}
            >
              <Share2 width={16} height={16} color={colors.text} />
              <Text style={styles.menuItemText}>Share List</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuForId(null);
                Alert.alert(
                  "Edit List",
                  "Editing isn't wired up yet.",
                );
              }}
            >
              <Edit2 width={16} height={16} color={colors.text} />
              <Text style={styles.menuItemText}>Edit List</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                const list = custom.find((l) => l.id === menuForId);
                if (list) deleteList(list);
              }}
            >
              <Trash2 width={16} height={16} color={colors.accentPink} />
              <Text style={[styles.menuItemText, { color: colors.accentPink }]}>
                Delete List
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateListSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
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
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: c.text },
    createBtn: { borderRadius: 999, overflow: "hidden" },
    createBtnGradient: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    scroll: { padding: 16, gap: 20 },

    section: { gap: 12 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: c.muted },

    // Default list grid — two per row
    defaultGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    defaultCard: {
      flexBasis: "48%",
      flexGrow: 0,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: "center",
      gap: 4,
    },
    defaultEmoji: { fontSize: 24, marginBottom: 2 },
    defaultName: { fontSize: 14, fontWeight: "700", color: c.text },
    defaultCount: { fontSize: 11, color: c.muted },

    // Custom list card
    customCard: {
      flexDirection: "row",
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
    },
    customMeta: { flex: 1, gap: 6 },
    customTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    customTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: c.text },
    menuBtn: { padding: 2 },
    customDesc: { fontSize: 13, color: c.muted, lineHeight: 18 },
    customFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: "auto",
    },
    customCount: { fontSize: 12, color: c.muted },
    customDot: { fontSize: 12, color: c.muted, marginHorizontal: 2 },
    privateBadge: { flexDirection: "row", alignItems: "center", gap: 4 },

    // Context menu
    menuBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      paddingTop: 120,
      paddingRight: 20,
    },
    menuCard: {
      minWidth: 180,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    menuItemText: { fontSize: 14, color: c.text, fontWeight: "600" },

    // Empty / error
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 14,
      gap: 4,
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    emptyBody: { fontSize: 13, color: c.muted, textAlign: "center" },

    errorBox: {
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accentPink,
      backgroundColor: "rgba(255,77,109,0.10)",
    },
    errorText: { color: c.accentPink, fontSize: 13 },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
  });
}
