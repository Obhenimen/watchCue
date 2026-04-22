import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Camera } from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { brandLinearGradient } from "@/constants/theme";
import type { AppColors } from "@/constants/theme";
import { api, mediaUrl } from "@/lib/api";
import { getAccessToken, getStoredUser, setStoredUser } from "@/lib/storage";

// ── Constants ────────────────────────────────────────────────────────────────

const DISPLAY_NAME_MAX = 60;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const USERNAME_RE = /^[a-zA-Z0-9._]+$/;
const BIO_MAX = 500;

// Matches watch-nestjs avatarMulterOptions (same whitelist as images on posts).
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const ALLOWED_AVATAR_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// ── Types ────────────────────────────────────────────────────────────────────

interface Profile {
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

type PickedAvatar = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function mimeFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] ?? "image/jpeg";
}

function formatBytes(n: number | undefined): string {
  if (!n || n <= 0) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [initial, setInitial] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load current profile ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<Profile>("/users/me");
        if (cancelled) return;
        setInitial(data);
        setDisplayName(data.displayName ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
      } catch (e) {
        if (cancelled) return;
        setLoadError(
          e instanceof Error ? e.message : "Could not load your profile.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────

  const usernameError = useMemo(() => {
    const u = username.trim();
    if (!u) return "Username is required.";
    if (u.length < USERNAME_MIN)
      return `Username must be at least ${USERNAME_MIN} characters.`;
    if (u.length > USERNAME_MAX)
      return `Username must be at most ${USERNAME_MAX} characters.`;
    if (!USERNAME_RE.test(u))
      return "Only letters, numbers, dots, and underscores are allowed.";
    return null;
  }, [username]);

  const displayNameError = useMemo(() => {
    const d = displayName.trim();
    if (!d) return "Display name is required.";
    if (d.length > DISPLAY_NAME_MAX)
      return `Display name must be at most ${DISPLAY_NAME_MAX} characters.`;
    return null;
  }, [displayName]);

  // Dirty check — only send what changed, and disable Save when nothing did.
  const changes = useMemo(() => {
    if (!initial) return null;
    const trimmedDisplay = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedBio = bio.trim();
    const initialBio = (initial.bio ?? "").trim();
    const diffs: {
      displayName?: string;
      username?: string;
      bio?: string | null;
      avatar?: PickedAvatar;
    } = {};
    if (trimmedDisplay !== initial.displayName) diffs.displayName = trimmedDisplay;
    if (trimmedUsername !== initial.username) diffs.username = trimmedUsername;
    if (trimmedBio !== initialBio) diffs.bio = trimmedBio;
    if (avatar) diffs.avatar = avatar;
    return diffs;
  }, [initial, displayName, username, bio, avatar]);

  const hasChanges = !!changes && Object.keys(changes).length > 0;
  const canSubmit =
    hasChanges &&
    !submitting &&
    !displayNameError &&
    !usernameError;

  // ── Avatar picker ─────────────────────────────────────────────────────────

  const pickAvatar = useCallback(
    async (source: "library" | "camera") => {
      if (source === "library") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Permission needed",
            "Allow photo library access in Settings to change your avatar.",
          );
          return;
        }
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Permission needed",
            "Allow camera access in Settings to capture a new avatar.",
          );
          return;
        }
      }

      const launcher =
        source === "library"
          ? ImagePicker.launchImageLibraryAsync
          : ImagePicker.launchCameraAsync;

      const res = await launcher({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const name =
        asset.fileName ?? asset.uri.split("/").pop() ?? "avatar.jpg";
      const mimeType = asset.mimeType ?? mimeFromFilename(name);

      if (!ALLOWED_AVATAR_MIMES.has(mimeType.toLowerCase())) {
        Alert.alert(
          "Unsupported format",
          `${mimeType} isn't supported. Use JPEG, PNG, GIF, or WEBP.`,
        );
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        Alert.alert(
          "Image too large",
          `Image is ${formatBytes(asset.fileSize)}. Max is ${formatBytes(
            MAX_AVATAR_BYTES,
          )}.`,
        );
        return;
      }

      setAvatar({
        uri: asset.uri,
        name,
        mimeType,
        size: asset.fileSize,
      });
    },
    [],
  );

  const promptAvatarSource = useCallback(() => {
    Alert.alert("Change photo", undefined, [
      { text: "Photo Library", onPress: () => pickAvatar("library") },
      { text: "Take Photo", onPress: () => pickAvatar("camera") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [pickAvatar]);

  // ── Submit ────────────────────────────────────────────────────────────────
  // The shared `api` helper exposes GET/POST/DELETE, but /users/me is PATCH,
  // so submit goes through the patchMultipart helper defined at the bottom.

  const submit = useCallback(async () => {
    if (!canSubmit || !initial || !changes) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      if (changes.displayName !== undefined)
        form.append("displayName", changes.displayName);
      if (changes.username !== undefined)
        form.append("username", changes.username);
      if (changes.bio !== undefined) form.append("bio", changes.bio ?? "");
      if (changes.avatar) {
        form.append(
          "avatar",
          {
            uri:
              Platform.OS === "ios"
                ? changes.avatar.uri.replace("file://", "")
                : changes.avatar.uri,
            name: changes.avatar.name,
            type: changes.avatar.mimeType,
          } as unknown as Blob,
        );
      }

      const updated = await patchMultipart<Profile>("/users/me", form);

      // Keep MMKV cache in sync so other screens (profile, feed) see the
      // new display name / avatar without waiting for a refetch.
      const stored = getStoredUser();
      if (stored) {
        setStoredUser({
          ...stored,
          name: updated.displayName,
          username: updated.username,
          bio: updated.bio,
          profilePictureUrl: updated.avatarUrl,
        });
      }

      router.back();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, initial, changes, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  const avatarPreview = avatar?.uri ?? mediaUrl(initial?.avatarUrl) ?? null;
  const initials = (
    (initial?.displayName ?? initial?.username ?? displayName ?? "?") as string
  )
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.iconBtn}
      >
        <ArrowLeft width={22} height={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Edit Profile</Text>
      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        hitSlop={10}
        style={styles.submitBtn}
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
            Save
          </Text>
        )}
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

  if (loadError || !initial) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load your profile</Text>
          {loadError && (
            <Text style={styles.errorBody} selectable>
              {loadError}
            </Text>
          )}
        </View>
      </View>
    );
  }

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
        {/* Avatar */}
        <View style={styles.avatarBlock}>
          <Pressable onPress={promptAvatarSource} style={styles.avatarPressable}>
            <LinearGradient
              colors={brandLinearGradient.colors}
              locations={[...brandLinearGradient.locations]}
              start={brandLinearGradient.start}
              end={brandLinearGradient.end}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {avatarPreview ? (
                  <Image
                    source={{ uri: avatarPreview }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
            </LinearGradient>
            <View style={styles.cameraBadge}>
              <Camera width={14} height={14} color="#fff" />
            </View>
          </Pressable>
          <Pressable onPress={promptAvatarSource}>
            <Text style={styles.changePhotoText}>Change photo</Text>
          </Pressable>
        </View>

        {/* Display Name */}
        <Text style={styles.label}>
          Display Name <Text style={styles.required}>*</Text>
        </Text>
        <View
          style={[
            styles.field,
            displayNameError && styles.fieldError,
          ]}
        >
          <TextInput
            value={displayName}
            onChangeText={(t) =>
              setDisplayName(
                t.length > DISPLAY_NAME_MAX ? t.slice(0, DISPLAY_NAME_MAX) : t,
              )
            }
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={DISPLAY_NAME_MAX}
            autoCapitalize="words"
          />
        </View>
        {displayNameError && (
          <Text style={styles.fieldErrorText}>{displayNameError}</Text>
        )}

        {/* Username */}
        <Text style={styles.label}>
          Username <Text style={styles.required}>*</Text>
        </Text>
        <View
          style={[
            styles.field,
            styles.fieldRow,
            usernameError && styles.fieldError,
          ]}
        >
          <Text style={styles.fieldPrefix}>@</Text>
          <TextInput
            value={username}
            onChangeText={(t) =>
              setUsername(
                t.length > USERNAME_MAX ? t.slice(0, USERNAME_MAX) : t,
              )
            }
            placeholder="username"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX}
          />
        </View>
        {usernameError && (
          <Text style={styles.fieldErrorText}>{usernameError}</Text>
        )}

        {/* Bio */}
        <Text style={styles.label}>Bio</Text>
        <View style={[styles.field, styles.bioField]}>
          <TextInput
            value={bio}
            onChangeText={(t) =>
              setBio(t.length > BIO_MAX ? t.slice(0, BIO_MAX) : t)
            }
            placeholder="Tell people a little about yourself..."
            placeholderTextColor={colors.muted}
            style={styles.bioInput}
            multiline
            textAlignVertical="top"
            maxLength={BIO_MAX}
          />
        </View>
        <Text style={styles.counter}>
          {bio.length}/{BIO_MAX}
        </Text>

        {submitError && (
          <View style={styles.submitErrorBox}>
            <Text style={styles.submitErrorText} selectable>
              {submitError}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── PATCH multipart helper ───────────────────────────────────────────────────
// The shared `api` helper exposes GET/POST/DELETE. Profile edits need PATCH
// with multipart, so we implement it inline here rather than expanding the
// public helper surface for a single caller.

async function patchMultipart<T>(path: string, form: FormData): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  const prefix = (process.env.EXPO_PUBLIC_API_PREFIX ?? "").replace(
    /^\/+|\/+$/g,
    "",
  );
  if (!base) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_URL. Set it in .env and restart Expo.",
    );
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = prefix ? `${base}/${prefix}${p}` : `${base}${p}`;
  const token = getAccessToken();

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Deliberately omit Content-Type so fetch sets the multipart boundary.
    },
    body: form,
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { message?: string | string[] })?.message ??
      res.statusText ??
      "Request failed";
    const text = Array.isArray(msg) ? msg.join(", ") : msg;
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return data as T;
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
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: c.text,
      flex: 1,
      textAlign: "center",
    },
    submitBtn: { paddingHorizontal: 8, paddingVertical: 6 },
    submitText: { color: c.accent, fontWeight: "700", fontSize: 16 },

    scroll: { padding: 16, gap: 8 },

    // Avatar block
    avatarBlock: {
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      marginBottom: 16,
    },
    avatarPressable: { position: "relative" },
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
    cameraBadge: {
      position: "absolute",
      right: 4,
      bottom: 4,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.background,
    },
    changePhotoText: {
      color: c.accent,
      fontWeight: "600",
      fontSize: 14,
    },

    // Fields
    label: { fontSize: 13, fontWeight: "600", color: c.muted, marginTop: 10 },
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
    fieldRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    fieldPrefix: { color: c.muted, fontSize: 15, fontWeight: "600" },
    fieldError: { borderColor: c.accentPink },
    fieldErrorText: {
      color: c.accentPink,
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
    input: { color: c.text, fontSize: 15, padding: 0 },

    bioField: { paddingVertical: 12, minHeight: 120 },
    bioInput: { color: c.text, fontSize: 15, minHeight: 100, padding: 0 },
    counter: {
      alignSelf: "flex-end",
      fontSize: 11,
      color: c.muted,
      marginTop: 4,
    },

    submitErrorBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accentPink,
      backgroundColor: "rgba(255,77,109,0.10)",
    },
    submitErrorText: { color: c.accentPink, fontSize: 13 },

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
