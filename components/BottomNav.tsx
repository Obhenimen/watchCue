import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Film, Home, User } from "lucide-react-native";
import { colors } from "@/constants/theme";

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const feedActive = pathname === "/feed";
  const hubsActive = pathname === "/hubs" || pathname.startsWith("/hub/");
  const profileActive =
    pathname === "/profile" || pathname === "/settings";

  const item = (active: boolean) => ({
    color: active ? colors.accent : "#9CA3AF",
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.inner}>
        <Pressable
          onPress={() => router.replace("/feed")}
          style={styles.tab}
          accessibilityRole="button"
          accessibilityLabel="Feed"
        >
          <Home width={24} height={24} color={item(feedActive).color} />
          <Text style={[styles.label, item(feedActive)]}>Feed</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/hubs")}
          style={styles.tab}
          accessibilityRole="button"
          accessibilityLabel="Hubs"
        >
          <Film width={24} height={24} color={item(hubsActive).color} />
          <Text style={[styles.label, item(hubsActive)]}>Hubs</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/profile")}
          style={styles.tab}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <User width={24} height={24} color={item(profileActive).color} />
          <Text style={[styles.label, item(profileActive)]}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1A1A2E",
    zIndex: 50,
  },
  inner: {
    maxWidth: 448,
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  tab: {
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 12,
  },
});
