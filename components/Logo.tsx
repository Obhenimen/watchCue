import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { colors } from "@/constants/theme";

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
  const textWidth = Math.ceil(appName.length * fontSize * 0.62);
  const textSvgHeight = Math.ceil(fontSize * 1.25);

  return (
    <View style={styles.row}>
      <Svg width={icon} height={icon} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="wcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.brandGradient[0]} />
            <Stop offset="50%" stopColor={colors.brandGradient[1]} />
            <Stop offset="100%" stopColor={colors.brandGradient[2]} />
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
        <Svg width={textWidth} height={textSvgHeight}>
          <Defs>
            <LinearGradient id="wcGradText" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.brandGradient[0]} />
              <Stop offset="50%" stopColor={colors.brandGradient[1]} />
              <Stop offset="100%" stopColor={colors.brandGradient[2]} />
            </LinearGradient>
          </Defs>
          <SvgText
            x="0"
            y={fontSize * 0.88}
            fontSize={fontSize}
            fontWeight="600"
            fill="url(#wcGradText)"
          >
            {appName}
          </SvgText>
        </Svg>
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
});
