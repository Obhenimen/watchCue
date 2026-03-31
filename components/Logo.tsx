import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  appName?: string;
};

const iconSizes = { sm: 24, md: 32, lg: 48 };
const textSizes = { sm: 18, md: 24, lg: 32 };

export function Logo({ size = "md", showText = true, appName = "WatchCue" }: LogoProps) {
  const icon = iconSizes[size];
  const fontSize = textSizes[size];

  return (
    <View style={styles.row}>
      <Svg width={icon} height={icon} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="wcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF4D6D" />
            <Stop offset="50%" stopColor="#A855F7" />
            <Stop offset="100%" stopColor="#00C9B1" />
          </LinearGradient>
        </Defs>
        <Rect x="8" y="12" width="32" height="24" rx="3" stroke="url(#wcGrad)" strokeWidth={2.5} fill="none" />
        <Rect x="10" y="15" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="10" y="20" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="10" y="25" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="10" y="30" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="36" y="15" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="36" y="20" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="36" y="25" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Rect x="36" y="30" width="2" height="2" fill="url(#wcGrad)" rx="0.5" />
        <Path d="M21 20L29 24L21 28V20Z" fill="url(#wcGrad)" />
      </Svg>
      {showText && (
        <Text style={[styles.appName, { fontSize }]}>{appName}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appName: {
    fontWeight: "600",
    color: "#00C9B1",
  },
});
