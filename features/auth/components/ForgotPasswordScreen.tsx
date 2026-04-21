import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Logo } from "@/components/Logo";
import { brandLinearGradient, colors } from "@/constants/theme";
import { api } from "@/lib/api";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = !!email.trim();

  const handleSend = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientStart]}
      style={styles.gradient}
    >
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
          <View style={styles.logoWrap}>
            <Logo size="lg" />
          </View>

          <View style={styles.card}>
            {sent ? (
              <View style={styles.sentState}>
                <Text style={styles.sentIcon}>📬</Text>
                <Text style={styles.h1}>Check your inbox</Text>
                <Text style={styles.sub}>
                  We sent a password reset link to{"\n"}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
                <Text style={styles.spamNote}>
                  Didn't receive it? Check your spam folder or{" "}
                  <Text style={styles.retryLink} onPress={() => setSent(false)}>
                    try again
                  </Text>
                  .
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.h1}>Forgot Password?</Text>
                <Text style={styles.sub}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="john@example.com"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Pressable
                  onPress={handleSend}
                  disabled={!canSubmit || submitting}
                  style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
                >
                  <LinearGradient
                    colors={
                      canSubmit && !submitting
                        ? brandLinearGradient.colors
                        : ["#1F2937", "#1F2937"]
                    }
                    locations={
                      canSubmit && !submitting
                        ? [...brandLinearGradient.locations]
                        : [0, 1]
                    }
                    start={brandLinearGradient.start}
                    end={brandLinearGradient.end}
                    style={styles.submitGradient}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>Send Reset Link</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => router.back()}
            style={styles.backRow}
          >
            <ChevronLeft size={18} color={colors.accent} />
            <Text style={styles.backLink}>Back to Login</Text>
          </Pressable>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 16 },
  logoWrap: { alignItems: "center", marginBottom: 40 },
  card: {
    backgroundColor: "rgba(74, 74, 94, 0.35)",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#374151",
  },
  h1: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  sub: { color: "#9CA3AF", marginBottom: 24, lineHeight: 22 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, color: "#D1D5DB", marginBottom: 8 },
  input: {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  submitBtn: {
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  sentState: { alignItems: "center", paddingVertical: 8 },
  sentIcon: { fontSize: 48, marginBottom: 16 },
  emailHighlight: { color: "#fff", fontWeight: "600" },
  spamNote: { color: "#9CA3AF", fontSize: 14, textAlign: "center", marginTop: 16, lineHeight: 20 },
  retryLink: { color: colors.accent, fontWeight: "500" },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 28,
  },
  backLink: { color: colors.accent, fontSize: 15, fontWeight: "500" },
});
