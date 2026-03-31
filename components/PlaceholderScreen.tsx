import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { BottomNav } from "@/components/BottomNav";
import { colors } from "@/constants/theme";

type Props = {
  title: string;
  description?: string;
  /** Match WatchCueWeb: main tab surfaces show the bottom bar */
  showBottomNav?: boolean;
  showBack?: boolean;
};

export function PlaceholderScreen({
  title,
  description = "This screen is wired for navigation. Port UI from WatchCueWeb when you are ready.",
  showBottomNav = false,
  showBack = true,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: showBottomNav ? 96 + insets.bottom : insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.header}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft color={colors.text} size={28} />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.desc}>{description}</Text>
      {showBottomNav && <BottomNav />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerSpacer: { width: 28 },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
