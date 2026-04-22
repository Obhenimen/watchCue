import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/features/theme/ThemeContext";
import { api } from "@/lib/api";
import type { AppColors } from "@/constants/theme";
import type { UserList } from "../types";

const NAME_MAX = 100;
const DESC_MAX = 500;

/** Emoji palette — first 12 match the "Choose an emoji" grid in the figma. */
const EMOJI_OPTIONS = [
  "📝",
  "🎬",
  "❤️",
  "⭐",
  "🔥",
  "💀",
  "💕",
  "🧠",
  "☀️",
  "🍿",
  "🃏",
  "🏆",
];

export function CreateListSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (list: UserList) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [emoji, setEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  const reset = useCallback(() => {
    setEmoji(EMOJI_OPTIONS[0]);
    setName("");
    setDescription("");
    setIsPublic(false);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<UserList>("/lists", {
        name: name.trim(),
        emoji,
        description: description.trim() || undefined,
        isPublic,
      });
      onCreated(created);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create list.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, name, emoji, description, isPublic, onCreated, onClose, reset]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            <Text style={styles.title}>Create New List</Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 14 }}
            >
              {/* Emoji grid */}
              <Text style={styles.label}>Choose an emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((e) => {
                  const active = emoji === e;
                  return (
                    <Pressable
                      key={e}
                      onPress={() => setEmoji(e)}
                      style={styles.emojiCellWrap}
                    >
                      {active ? (
                        <LinearGradient
                          colors={[
                            colors.accentPink,
                            colors.accentPurple,
                            colors.accent,
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.emojiCellActive}
                        >
                          <Text style={styles.emojiText}>{e}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.emojiCell}>
                          <Text style={styles.emojiText}>{e}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Name */}
              <Text style={styles.label}>
                List Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.field}>
                <TextInput
                  value={name}
                  onChangeText={(t) =>
                    setName(t.length > NAME_MAX ? t.slice(0, NAME_MAX) : t)
                  }
                  placeholder="e.g., Horror Classics"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  maxLength={NAME_MAX}
                />
              </View>

              {/* Description */}
              <Text style={styles.label}>Description (Optional)</Text>
              <View style={[styles.field, styles.descField]}>
                <TextInput
                  value={description}
                  onChangeText={(t) =>
                    setDescription(
                      t.length > DESC_MAX ? t.slice(0, DESC_MAX) : t,
                    )
                  }
                  placeholder="What's this list about?"
                  placeholderTextColor={colors.muted}
                  style={styles.descInput}
                  multiline
                  textAlignVertical="top"
                  maxLength={DESC_MAX}
                />
              </View>

              {/* Public toggle */}
              <View style={styles.publicRow}>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: colors.border, true: colors.accentPurple }}
                  thumbColor="#fff"
                  ios_backgroundColor={colors.border}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.publicTitle}>Make this list public</Text>
                  <Text style={styles.publicSub}>
                    Others can see and follow this list
                  </Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText} selectable>
                    {error}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer buttons */}
            <View style={styles.footer}>
              <Pressable
                onPress={handleClose}
                disabled={submitting}
                style={[styles.btn, styles.btnOutline]}
              >
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={[styles.btn, styles.btnPrimary]}
              >
                {canSubmit ? (
                  <LinearGradient
                    colors={[
                      colors.accentPink,
                      colors.accentPurple,
                      colors.accent,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnPrimaryGradient}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Create List</Text>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={styles.btnPrimaryDisabled}>
                    <Text style={styles.btnPrimaryTextDisabled}>
                      Create List
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheetWrap: { width: "100%" },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: "92%",
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 10,
    },
    title: { fontSize: 20, fontWeight: "800", color: c.text, marginBottom: 14 },

    label: { fontSize: 13, fontWeight: "600", color: c.muted },
    required: { color: c.accentPink },

    // Emoji grid
    emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    emojiCellWrap: { width: 52, height: 52 },
    emojiCell: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiCellActive: {
      width: 52,
      height: 52,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiText: { fontSize: 24 },

    // Inputs
    field: {
      backgroundColor: c.background,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    input: { color: c.text, fontSize: 15, padding: 0 },
    descField: { minHeight: 100, paddingVertical: 10 },
    descInput: { color: c.text, fontSize: 15, minHeight: 86, padding: 0 },

    // Public toggle
    publicRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 6,
    },
    publicTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    publicSub: { fontSize: 12, color: c.muted, marginTop: 2 },

    errorBox: {
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accentPink,
      backgroundColor: "rgba(255,77,109,0.10)",
    },
    errorText: { color: c.accentPink, fontSize: 13 },

    // Footer
    footer: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: 14,
    },
    btn: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      overflow: "hidden",
    },
    btnOutline: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    btnOutlineText: { color: c.text, fontWeight: "700", fontSize: 15 },
    btnPrimary: {},
    btnPrimaryGradient: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    btnPrimaryDisabled: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    btnPrimaryTextDisabled: { color: c.muted, fontWeight: "700", fontSize: 15 },
  });
}
