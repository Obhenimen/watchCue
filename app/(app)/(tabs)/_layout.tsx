import { Tabs } from "expo-router";
import { Film, Home, Settings, User } from "lucide-react-native";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/features/theme/ThemeContext";

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  // The default tab bar height doesn't grow with padding, so adding a top
  // pad alone clips the labels — especially on Android where the system nav
  // bar pushes the bar up. Compute an explicit height that accounts for the
  // bottom inset (gesture handle / nav bar) plus our top breathing room.
  const topPad = 4;
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 4 : 2);
  const contentRoom = 44; // icon + label
  const tabBarHeight = topPad + contentRoom + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingTop: topPad,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        // Push the icon down a touch so it sits inside the new top padding
        // rather than crowding the top border.
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => (
            <Home width={24} height={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hubs"
        options={{
          title: "Hubs",
          tabBarIcon: ({ color }) => (
            <Film width={24} height={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <User width={24} height={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Settings width={24} height={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
