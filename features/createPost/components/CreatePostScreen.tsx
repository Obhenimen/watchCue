import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ArrowLeft,
  ImageIcon,
  RefreshCw,
  Search,
  Video,
  X,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api } from "@/lib/api";
import type { AppColors } from "@/constants/theme";
import type {
  FollowedHubsResponse,
  Hub,
  SearchHubsResponse,
} from "@/features/hubs/types";

// ── Constants ────────────────────────────────────────────────────────────────

const TITLE_MAX = 150; // matches backend CreatePostDto @MaxLength(150)
const BODY_MAX = 5000; // matches backend CreatePostDto @MaxLength(5000)

const TAG_OPTIONS = ["Review", "Discussion", "Clip", "Theory", "Recommendation"];

// Backend upload limits — see watch-nestjs/src/common/multer/multer.config.ts
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; //  10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/avi",
  "video/webm",
]);

function mimeFromFilename(name: string, fallbackKind: "image" | "video"): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4",
    avi: "video/x-msvideo",
    webm: "video/webm",
  };
  if (map[ext]) return map[ext];
  return fallbackKind === "image" ? "image/jpeg" : "video/mp4";
}

function formatBytes(n: number | undefined): string {
  if (!n || n <= 0) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Hub picker modal ─────────────────────────────────────────────────────────

function HubPickerModal({
  visible,
  onClose,
  onPick,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (hub: Pick<Hub, "id" | "name">) => void;
  colors: AppColors;
}) {
  const styles = useMemo(() => createPickerStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [followed, setFollowed] = useState<Hub[]>([]);
  const [results, setResults] = useState<Hub[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Load followed hubs when the modal opens
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<FollowedHubsResponse>("/hubs/followed");
        if (!cancelled) setFollowed(data.hubs ?? []);
      } catch {
        if (!cancelled) setFollowed([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Debounced search
  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await api.get<SearchHubsResponse>(
          `/hubs/search?q=${encodeURIComponent(trimmed)}&limit=20`,
        );
        if (!cancelled) setResults(data.hubs ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, visible]);

  const list = results ?? followed;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalScreen,
          // Push content below the status bar / notch so the close button
          // isn't sitting under system UI and ignoring taps.
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Choose a hub</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X width={22} height={22} color={colors.text} />
          </Pressable>
        </View>
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

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {results === null && (
              <Text style={styles.sectionLabel}>Hubs you follow</Text>
            )}
            {list.length === 0 ? (
              <Text style={styles.empty}>
                {results === null
                  ? "You don't follow any hubs yet. Try searching."
                  : `No hubs match "${query}".`}
              </Text>
            ) : (
              list.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    onPick({ id: h.id, name: h.name });
                    onClose();
                  }}
                  style={styles.row}
                >
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle}>{h.name}</Text>
                    {h.year != null && (
                      <Text style={styles.rowSub}>{h.year}</Text>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Media preview ────────────────────────────────────────────────────────────

function MediaPreview({
  media,
  onReplace,
  onRemove,
  styles,
  colors,
}: {
  media: SelectedMedia;
  onReplace: () => void;
  onRemove: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  // Paused player — shows the first frame as a thumbnail. Rebuilt whenever
  // the URI changes so a replaced video refreshes.
  const player = useVideoPlayer(
    media.kind === "video" ? media.uri : "",
    (p) => {
      p.muted = true;
      p.pause();
    },
  );

  const metaLine = [
    media.width && media.height ? `${media.width}×${media.height}` : null,
    media.kind === "video" ? formatDuration(media.duration) || null : null,
    formatBytes(media.size) || null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={styles.mediaPreviewWrap}>
      {media.kind === "image" ? (
        <Image
          source={{ uri: media.uri }}
          style={styles.mediaPreview}
          contentFit="cover"
        />
      ) : (
        <View style={styles.mediaPreview}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
          {media.duration ? (
            <View style={styles.mediaDurationBadge}>
              <Video width={12} height={12} color="#fff" />
              <Text style={styles.mediaDurationText}>
                {formatDuration(media.duration)}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Top-right: remove */}
      <Pressable onPress={onRemove} style={styles.mediaRemove} hitSlop={8}>
        <X width={18} height={18} color="#fff" />
      </Pressable>

      {/* Bottom overlay: filename + meta + replace */}
      <View style={styles.mediaOverlay}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mediaPreviewName} numberOfLines={1}>
            {media.name}
          </Text>
          {metaLine ? (
            <Text style={styles.mediaPreviewMeta} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onReplace} style={styles.replaceBtn} hitSlop={6}>
          <RefreshCw width={14} height={14} color={colors.text} />
          <Text style={styles.replaceText}>Replace</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

type SelectedMedia = {
  uri: string;
  name: string;
  mimeType: string;
  kind: "image" | "video";
  size?: number;
  width?: number;
  height?: number;
  /** Seconds (videos only) */
  duration?: number | null;
};

export function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hub, setHub] = useState<{ id: string; name: string } | null>(null);
  const [hubPickerOpen, setHubPickerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleCount = title.length;
  const canSubmit = !!hub && body.trim().length > 0 && !submitting;

  // ── Media pickers ─────────────────────────────────────────────────────────

  /**
   * Validate a picked asset against the backend's upload rules. Returns an
   * error message if rejected, or null if accepted. Same limits as
   * watch-nestjs/src/common/multer/multer.config.ts.
   */
  const validateAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset, kind: "image" | "video"): string | null => {
      const fallbackName =
        asset.fileName ??
        asset.uri.split("/").pop() ??
        (kind === "image" ? "photo.jpg" : "video.mp4");
      const mimeType = asset.mimeType ?? mimeFromFilename(fallbackName, kind);
      const allowed =
        kind === "image" ? ALLOWED_IMAGE_MIMES : ALLOWED_VIDEO_MIMES;
      if (!allowed.has(mimeType.toLowerCase())) {
        return kind === "image"
          ? `Unsupported image format (${mimeType}). Use JPEG, PNG, GIF, or WEBP.`
          : `Unsupported video format (${mimeType}). Use MP4, MOV, AVI, or WEBM.`;
      }
      const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (asset.fileSize && asset.fileSize > maxBytes) {
        return `${kind === "image" ? "Image" : "Video"} is ${formatBytes(asset.fileSize)}. Max is ${formatBytes(maxBytes)}.`;
      }
      return null;
    },
    [],
  );

  const adoptAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset, kind: "image" | "video") => {
      const err = validateAsset(asset, kind);
      if (err) {
        Alert.alert("Can't use that file", err);
        return;
      }
      const fileName =
        asset.fileName ??
        asset.uri.split("/").pop() ??
        (kind === "image" ? "photo.jpg" : "video.mp4");
      const mimeType = asset.mimeType ?? mimeFromFilename(fileName, kind);
      setMedia({
        uri: asset.uri,
        name: fileName,
        mimeType,
        kind,
        size: asset.fileSize,
        width: asset.width,
        height: asset.height,
        duration: kind === "video" ? asset.duration ?? null : null,
      });
    },
    [validateAsset],
  );

  const pickFromLibrary = useCallback(
    async (kind: "image" | "video") => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access in Settings to attach media.",
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === "image" ? ["images"] : ["videos"],
        quality: 0.85,
        selectionLimit: 1,
        allowsEditing: kind === "image", // cropping only for images
        videoMaxDuration: 300, // 5 min cap at picker level — belt + braces with MAX_VIDEO_BYTES
      });
      if (res.canceled || !res.assets?.[0]) return;
      adoptAsset(res.assets[0], kind);
    },
    [adoptAsset],
  );

  const pickFromCamera = useCallback(
    async (kind: "image" | "video") => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow camera access in Settings to capture media.",
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: kind === "image" ? ["images"] : ["videos"],
        quality: 0.85,
        allowsEditing: kind === "image",
        videoMaxDuration: 300,
      });
      if (res.canceled || !res.assets?.[0]) return;
      adoptAsset(res.assets[0], kind);
    },
    [adoptAsset],
  );

  const promptMediaSource = useCallback(
    (kind: "image" | "video") => {
      Alert.alert(
        kind === "image" ? "Add image" : "Add video clip",
        undefined,
        [
          {
            text: kind === "image" ? "Photo Library" : "Video Library",
            onPress: () => pickFromLibrary(kind),
          },
          {
            text: kind === "image" ? "Take Photo" : "Record Video",
            onPress: () => pickFromCamera(kind),
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
    },
    [pickFromLibrary, pickFromCamera],
  );

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    if (!canSubmit || !hub) return;
    setSubmitting(true);
    setSubmitError(null);

    const form = new FormData();
    form.append("hubId", hub.id);
    if (title.trim()) form.append("title", title.trim());
    form.append("body", body.trim());
    form.append("hasSpoiler", hasSpoiler ? "true" : "false");
    if (media) {
      // React Native FormData uses a Blob-like { uri, name, type } shape.
      form.append(
        "media",
        {
          uri:
            Platform.OS === "ios" ? media.uri.replace("file://", "") : media.uri,
          name: media.name,
          type: media.mimeType,
        } as unknown as Blob,
      );
    }

    try {
      const created = await api.post<{ id: string }>("/posts", form);
      router.replace(`/post/${created.id}`);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Could not publish your post.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, hub, title, body, hasSpoiler, media, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Create Post</Text>
      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={styles.submitBtn}
        hitSlop={10}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text
            style={[
              styles.submitText,
              !canSubmit && { color: colors.muted },
            ]}
          >
            Post
          </Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hub */}
        <Text style={styles.label}>
          Hub <Text style={styles.required}>*</Text>
        </Text>
        <Pressable
          onPress={() => setHubPickerOpen(true)}
          style={styles.field}
        >
          <Text style={hub ? styles.fieldValue : styles.fieldPlaceholder}>
            {hub?.name ?? "Choose a hub..."}
          </Text>
        </Pressable>

        {/* Title */}
        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.field}>
          <TextInput
            value={title}
            onChangeText={(t) =>
              setTitle(t.length > TITLE_MAX ? t.slice(0, TITLE_MAX) : t)
            }
            placeholder="What's your take?"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={TITLE_MAX}
          />
        </View>
        <Text style={styles.counter}>
          {titleCount}/{TITLE_MAX}
        </Text>

        {/* Tags */}
        <Text style={styles.label}>Tags</Text>
        <View style={styles.tagWrap}>
          {TAG_OPTIONS.map((tag) => {
            const active = tags.has(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[styles.tagChip, active && styles.tagChipActive]}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    active && styles.tagChipTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Spoiler toggle */}
        <View style={styles.spoilerRow}>
          <Switch
            value={hasSpoiler}
            onValueChange={setHasSpoiler}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
            ios_backgroundColor={colors.border}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.spoilerTitle}>Mark as Spoiler</Text>
            <Text style={styles.spoilerSub}>
              Content will be hidden by default
            </Text>
          </View>
        </View>

        {/* Content */}
        <Text style={styles.label}>
          Content <Text style={styles.required}>*</Text>
        </Text>
        <View style={[styles.field, styles.bodyField]}>
          <TextInput
            value={body}
            onChangeText={(t) =>
              setBody(t.length > BODY_MAX ? t.slice(0, BODY_MAX) : t)
            }
            placeholder="Share your thoughts..."
            placeholderTextColor={colors.muted}
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Media */}
        <Text style={styles.label}>Media (Optional)</Text>
        {media ? (
          <MediaPreview
            media={media}
            onReplace={() => promptMediaSource(media.kind)}
            onRemove={() => setMedia(null)}
            styles={styles}
            colors={colors}
          />
        ) : (
          <View style={styles.mediaRow}>
            <Pressable
              onPress={() => promptMediaSource("image")}
              style={styles.mediaBtn}
            >
              <ImageIcon width={28} height={28} color={colors.text} />
              <Text style={styles.mediaBtnLabel}>Upload Image</Text>
            </Pressable>
            <Pressable
              onPress={() => promptMediaSource("video")}
              style={styles.mediaBtn}
            >
              <Video width={28} height={28} color={colors.text} />
              <Text style={styles.mediaBtnLabel}>Upload Clip</Text>
            </Pressable>
          </View>
        )}

        {submitError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} selectable>
              {submitError}
            </Text>
          </View>
        )}
      </ScrollView>

      <HubPickerModal
        visible={hubPickerOpen}
        onClose={() => setHubPickerOpen(false)}
        onPick={setHub}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },

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
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: c.text, flex: 1, textAlign: "center" },
    submitBtn: { paddingHorizontal: 8, paddingVertical: 6 },
    submitText: { color: c.accent, fontWeight: "700", fontSize: 16 },

    scroll: { padding: 16, gap: 8 },

    label: { fontSize: 13, fontWeight: "600", color: c.muted, marginTop: 12 },
    required: { color: c.accentPink },

    field: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginTop: 6,
    },
    fieldPlaceholder: { color: c.muted, fontSize: 15 },
    fieldValue: { color: c.text, fontSize: 15, fontWeight: "500" },
    input: { color: c.text, fontSize: 15, padding: 0 },
    bodyField: { paddingVertical: 12, minHeight: 160 },
    bodyInput: { color: c.text, fontSize: 15, minHeight: 140, padding: 0 },

    counter: {
      alignSelf: "flex-end",
      fontSize: 11,
      color: c.muted,
      marginTop: 4,
    },

    tagWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 8,
    },
    tagChip: {
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    tagChipActive: {
      borderBottomWidth: 2,
      borderBottomColor: c.accent,
    },
    tagChipText: { fontSize: 14, color: c.text, fontWeight: "500" },
    tagChipTextActive: { color: c.accent, fontWeight: "700" },

    spoilerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
    },
    spoilerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    spoilerSub: { fontSize: 12, color: c.muted, marginTop: 2 },

    mediaRow: { flexDirection: "row", gap: 10, marginTop: 6 },
    mediaBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
      gap: 8,
    },
    mediaBtnLabel: { fontSize: 14, fontWeight: "600", color: c.text },

    mediaPreviewWrap: { marginTop: 6, position: "relative" },
    mediaPreview: {
      width: "100%",
      height: 220,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "#000",
    },
    mediaPreviewName: { fontSize: 13, color: "#fff", fontWeight: "600" },
    mediaPreviewMeta: {
      fontSize: 11,
      color: "rgba(255,255,255,0.75)",
      marginTop: 2,
    },
    mediaRemove: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    mediaDurationBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.65)",
    },
    mediaDurationText: { color: "#fff", fontSize: 11, fontWeight: "600" },
    mediaOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    replaceBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    replaceText: { color: c.text, fontSize: 12, fontWeight: "600" },

    errorBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accentPink,
      backgroundColor: "rgba(255,77,109,0.10)",
    },
    errorText: { color: c.accentPink, fontSize: 13 },
  });
}

function createPickerStyles(c: AppColors) {
  return StyleSheet.create({
    // paddingTop and paddingBottom are overridden inline using safe-area
    // insets so the close button clears the notch and the list clears the
    // home indicator.
    modalScreen: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: 16,
      gap: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.text },
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
    searchInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: c.muted,
      paddingVertical: 10,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    row: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowMeta: { gap: 2 },
    rowTitle: { fontSize: 15, fontWeight: "600", color: c.text },
    rowSub: { fontSize: 12, color: c.muted },
    empty: { color: c.muted, fontSize: 14, paddingVertical: 24, textAlign: "center" },
    center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  });
}
