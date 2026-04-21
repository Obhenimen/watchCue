import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";
import type { AppColors } from "@/constants/theme";
import { clearAuthSession, getStoredUser } from "@/lib/storage";
import { api } from "@/lib/api";

type NotifToggles = {
  likes: boolean;
  comments: boolean;
  newFollowers: boolean;
  hubActivity: boolean;
  recommendations: boolean;
};

type PrivacyToggles = {
  privateProfile: boolean;
  showWatchlist: boolean;
  showActivityStatus: boolean;
};

function SectionHeader({ title, colors }: { title: string; colors: AppColors }) {
  return (
    <Text style={[sectionStyles.text, { color: colors.muted }]}>{title}</Text>
  );
}

const sectionStyles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 28,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});

function Divider({ colors }: { colors: AppColors }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 56,
      }}
    />
  );
}

function NavRow({
  icon,
  label,
  value,
  colors,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  colors: AppColors;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={rowStyles.left}>
        <View style={rowStyles.iconWrap}>{icon}</View>
        <Text style={[rowStyles.label, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={rowStyles.right}>
        {value ? (
          <Text style={[rowStyles.value, { color: colors.muted }]}>{value}</Text>
        ) : null}
        <ChevronRight size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 24, alignItems: "center" },
  label: { fontSize: 16, fontWeight: "500" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { fontSize: 15 },
});

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
  trackColorTrue,
  colors,
  isLight,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  trackColorTrue?: string;
  colors: AppColors;
  isLight: boolean;
}) {
  const falseTrack = isLight ? "#D1D5DB" : "#3D3D50";
  const trueTrack = trackColorTrue ?? colors.accentPurple;

  return (
    <View style={toggleStyles.row}>
      <View style={toggleStyles.left}>
        <View style={toggleStyles.iconWrap}>{icon}</View>
        <View style={toggleStyles.textGroup}>
          <Text style={[toggleStyles.label, { color: colors.text }]}>{label}</Text>
          <Text style={[toggleStyles.desc, { color: colors.muted }]} numberOfLines={1}>
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: falseTrack, true: trueTrack }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={falseTrack}
      />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1, marginRight: 12 },
  iconWrap: { width: 24, alignItems: "center" },
  textGroup: { flex: 1 },
  label: { fontSize: 16, fontWeight: "500", marginBottom: 2 },
  desc: { fontSize: 12, lineHeight: 16 },
});

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight, toggleTheme } = useAppTheme();

  const [notif, setNotif] = useState<NotifToggles>({
    likes: true,
    comments: true,
    newFollowers: true,
    hubActivity: false,
    recommendations: true,
  });

  const [privacy, setPrivacy] = useState<PrivacyToggles>({
    privateProfile: false,
    showWatchlist: true,
    showActivityStatus: true,
  });

  const toggleNotif = (key: keyof NotifToggles) =>
    setNotif((p) => ({ ...p, [key]: !p[key] }));

  const togglePrivacy = (key: keyof PrivacyToggles) =>
    setPrivacy((p) => ({ ...p, [key]: !p[key] }));

  const handleLogOut = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          clearAuthSession();
          router.replace("/");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = getStoredUser();
              if (user?.id) {
                await api.delete(`/users/${user.id}`);
              }
            } catch {
              // Best-effort — still clear local session
            }
            clearAuthSession();
            router.replace("/");
          },
        },
      ],
    );
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  const ic = colors.text;
  const sz = 20;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ACCOUNT ── */}
        <SectionHeader title="ACCOUNT" colors={colors} />
        <View style={styles.card}>
          <NavRow icon={<User size={sz} color={ic} />} label="Edit Profile" colors={colors} />
          <Divider colors={colors} />
          <NavRow icon={<Lock size={sz} color={ic} />} label="Change Password" colors={colors} />
          <Divider colors={colors} />
          <NavRow icon={<Globe size={sz} color={ic} />} label="Language" value="English" colors={colors} />
        </View>

        {/* ── NOTIFICATIONS ── */}
        <SectionHeader title="NOTIFICATIONS" colors={colors} />
        <View style={styles.card}>
          <ToggleRow
            icon={<Bell size={sz} color={ic} />}
            label="Likes"
            description="Get notified when someone likes your post"
            value={notif.likes}
            onToggle={() => toggleNotif("likes")}
            trackColorTrue={colors.accentPurple}
            colors={colors}
            isLight={isLight}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon={<Bell size={sz} color={ic} />}
            label="Comments"
            description="Get notified when someone comments"
            value={notif.comments}
            onToggle={() => toggleNotif("comments")}
            trackColorTrue={colors.accentPurple}
            colors={colors}
            isLight={isLight}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon={<Bell size={sz} color={ic} />}
            label="New Followers"
            description="Get notified when someone follows you"
            value={notif.newFollowers}
            onToggle={() => toggleNotif("newFollowers")}
            trackColorTrue={colors.accentPurple}
            colors={colors}
            isLight={isLight}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon={<Bell size={sz} color={ic} />}
            label="Hub Activity"
            description="Get notified about activity in followed hubs"
            value={notif.hubActivity}
            onToggle={() => toggleNotif("hubActivity")}
            colors={colors}
            isLight={isLight}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon={<Bell size={sz} color={ic} />}
            label="Recommendations"
            description="Get personalized content suggestions"
            value={notif.recommendations}
            onToggle={() => toggleNotif("recommendations")}
            trackColorTrue={colors.accentPurple}
            colors={colors}
            isLight={isLight}
          />
        </View>

        {/* ── PRIVACY ── */}
        <SectionHeader title="PRIVACY" colors={colors} />
        <View style={styles.card}>
          <ToggleRow
            icon={<ShieldCheck size={sz} color={ic} />}
            label="Private Profile"
            description="Only followers can see your posts"
            value={privacy.privateProfile}
            onToggle={() => togglePrivacy("privateProfile")}
            colors={colors}
            isLight={isLight}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon={<ShieldCheck size={sz} color={ic} />}
            label="Show Watchlist"
            description="Let others see what you're watching"
            value={privacy.showWatchlist}
            onToggle={() => togglePrivacy("showWatchlist")}
            trackColorTrue={colors.accentPurple}
            colors={colors}
            isLight={isLight}
          />
          <Divider colors={colors} />
          <ToggleRow
            icon={<ShieldCheck size={sz} color={ic} />}
            label="Show Activity Status"
            description="Let others see when you're active"
            value={privacy.showActivityStatus}
            onToggle={() => togglePrivacy("showActivityStatus")}
            trackColorTrue={colors.accentPurple}
            colors={colors}
            isLight={isLight}
          />
        </View>

        {/* ── APPEARANCE ── */}
        <SectionHeader title="APPEARANCE" colors={colors} />
        <View style={styles.card}>
          <ToggleRow
            icon={
              isLight
                ? <Sun size={sz} color={ic} />
                : <Moon size={sz} color={ic} />
            }
            label="Light Mode"
            description="Toggle between light and dark themes"
            value={isLight}
            onToggle={toggleTheme}
            trackColorTrue="#F59E0B"
            colors={colors}
            isLight={isLight}
          />
        </View>

        {/* ── MORE ── */}
        <SectionHeader title="MORE" colors={colors} />
        <View style={styles.card}>
          <NavRow icon={<HelpCircle size={sz} color={ic} />} label="Help & Support" colors={colors} />
          <Divider colors={colors} />
          <NavRow icon={<Info size={sz} color={ic} />} label="About" colors={colors} />
        </View>

        {/* ── Actions ── */}
        <View style={styles.actionGroup}>
          <Pressable
            onPress={handleLogOut}
            style={({ pressed }) => [styles.logOutBtn, pressed && { opacity: 0.7 }]}
          >
            <LogOut size={18} color={colors.accentPink} />
            <Text style={styles.logOutText}>Log Out</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.deleteText, { color: colors.muted }]}>Delete Account</Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: colors.muted }]}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: c.text,
    },
    content: {
      paddingHorizontal: 16,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: "hidden",
    },
    actionGroup: {
      gap: 12,
      marginTop: 36,
    },
    logOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: c.surface,
    },
    logOutText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.accentPink,
    },
    deleteBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    deleteText: {
      fontSize: 16,
      fontWeight: "500",
    },
    version: {
      textAlign: "center",
      fontSize: 13,
      marginTop: 24,
    },
  });
}
