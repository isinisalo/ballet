export type ThemeMode = "dark";

const THEME_STORAGE_KEY = "ballet-theme";
const DEFAULT_THEME_MODE: ThemeMode = "dark";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === DEFAULT_THEME_MODE;

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  try {
    const storedThemeMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(storedThemeMode) ? storedThemeMode : DEFAULT_THEME_MODE;
  } catch (error) {
    console.warn("Unable to read stored theme mode.", error);
    return DEFAULT_THEME_MODE;
  }
};

export const persistThemeMode = (mode: ThemeMode) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Unable to persist theme mode.", error);
  }
};

export const resolveThemeMode = (mode: ThemeMode): ThemeMode => mode;

export const applyThemeMode = (mode: ThemeMode) => {
  const resolvedMode = resolveThemeMode(mode);
  document.documentElement.classList.add(resolvedMode);
  document.documentElement.style.colorScheme = resolvedMode;
};

export const initializeThemeMode = () => {
  applyThemeMode(getStoredThemeMode());
};
