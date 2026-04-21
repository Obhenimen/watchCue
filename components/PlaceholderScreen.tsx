import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";

type Props = {
  title: string;
  description?: string;
  showBack?: boolean;
};

export function PlaceholderScreen({
  title,
  description = "This screen is wired for navigation. Port UI from WatchCueWeb when you are ready.",
  showBack = true,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 16,
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
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={[styles.desc, { color: colors.muted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
  },
});
