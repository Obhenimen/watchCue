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
import { Eye, EyeOff } from "lucide-react-native";
import { Logo } from "@/components/Logo";
import { brandLinearGradient, colors } from "@/constants/theme";
import { api } from "@/lib/api";
import { setAccessToken, setStoredUser } from "@/lib/storage";
import type { StoredUser } from "@/lib/storage";

export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!(email.trim() && password);

  const handleLogin = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const response = await api.post<{ accessToken: string; user: StoredUser }>(
        "/auth/login",
        { email: email.trim(), password }
      );
      setAccessToken(response.accessToken);
      setStoredUser(response.user);
      router.replace("/feed");
    } catch (err) {
      Alert.alert(
        "Login failed",
        err instanceof Error ? err.message : "Check your email and password."
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
          <View style={styles.logoWrap}>
            <Logo size="lg" />
          </View>

          <View style={styles.card}>
            <Text style={styles.h1}>Welcome Back</Text>
            <Text style={styles.sub}>Sign in to your account</Text>

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

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  {showPassword
                    ? <EyeOff size={20} color="#6B7280" />
                    : <Eye size={20} color="#6B7280" />
                  }
                </Pressable>
              </View>
              <Pressable
                onPress={() => router.push("/forgot-password")}
                style={styles.forgotRow}
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
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
                  <Text style={styles.submitText}>Sign In</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupPrompt}>Don't have an account?</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.signupLink}> Sign Up</Text>
            </Pressable>
          </View>
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
  sub: { color: "#9CA3AF", marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, color: "#D1D5DB", marginBottom: 8 },
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotLink: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: "500",
  },
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
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  submitBtn: {
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
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
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  signupPrompt: { color: "#9CA3AF", fontSize: 15 },
  signupLink: { color: colors.accent, fontSize: 15, fontWeight: "600" },
});
