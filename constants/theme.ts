/** Pink → purple → teal; SVG logo uses 0% / 50% / 100% — keep stops in sync */
const BRAND_GRADIENT_STOPS = ["#FF4D6D", "#A855F7", "#00C9B1"] as const;

/** Same colors, axis, and stop positions as `Logo` SVG linear gradients */
export const brandLinearGradient = {
  colors: [...BRAND_GRADIENT_STOPS],
  locations: [0, 0.5, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

export const darkColors = {
  background: "#0D0D0F",
  surface: "#1A1A2E",
  border: "#374151",
  text: "#F0EFF4",
  textSecondary: "#8B8FA8",
  muted: "#8B8FA8",
  accent: "#00C9B1",
  accentPink: "#FF4D6D",
  accentPurple: "#A855F7",
  gradientStart: "#1E1E1F",
  gradientMid: "#4A4A5E",
  brandGradient: BRAND_GRADIENT_STOPS,
} as const;

export const lightColors = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  border: "#E5E5EA",
  text: "#0D0D0F",
  textSecondary: "#6B7280",
  muted: "#6B7280",
  accent: "#00C9B1",
  accentPink: "#FF4D6D",
  accentPurple: "#A855F7",
  gradientStart: "#F0EFF4",
  gradientMid: "#D1D5DB",
  brandGradient: BRAND_GRADIENT_STOPS,
} as const;

export type AppColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  muted: string;
  accent: string;
  accentPink: string;
  accentPurple: string;
  gradientStart: string;
  gradientMid: string;
  brandGradient: readonly string[];
};

/** Static dark-mode palette. Use `useAppTheme().colors` in components. */
export const colors = darkColors;
