import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { darkColors, lightColors, type AppColors } from "@/constants/theme";
import { storage } from "@/lib/storage";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "app.theme";

interface ThemeContextValue {
  theme: ThemeMode;
  colors: AppColors;
  isLight: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  colors: darkColors,
  isLight: false,
  toggleTheme: () => {},
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = storage.getString(STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      storage.set(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, isLight: theme === "light", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
