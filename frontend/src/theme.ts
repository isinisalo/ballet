export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "ballet-theme";
const DEFAULT_THEME_MODE: ThemeMode = "dark";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  try {
    const storedThemeMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(storedThemeMode) ? storedThemeMode : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
};

export const persistThemeMode = (mode: ThemeMode) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Theme persistence is best-effort; applying the class still keeps the UI usable.
  }
};

export const resolveThemeMode = (mode: ThemeMode): "light" | "dark" => {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const applyThemeMode = (mode: ThemeMode) => {
  const resolvedMode = resolveThemeMode(mode);
  document.documentElement.classList.toggle("dark", resolvedMode === "dark");
  document.documentElement.style.colorScheme = resolvedMode;
};

export const initializeThemeMode = () => {
  applyThemeMode(getStoredThemeMode());
};
