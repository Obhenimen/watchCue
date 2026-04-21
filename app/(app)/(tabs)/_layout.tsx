import { Tabs } from "expo-router";
import { Film, Home, Settings, User } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { useAppTheme } from "@/features/theme/ThemeContext";

export default function TabsLayout() {
  const { colors } = useAppTheme();

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
        },
        tabBarLabelStyle: {
          fontSize: 12,
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
