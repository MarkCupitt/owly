"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeAppearanceStore {
  themePreset: string;
  themeOverrides: Record<string, string>;
  themeLogoUrl: string;
  themeLogoDarkUrl: string;
  themeFaviconUrl: string;
  setAppearance: (data: Partial<Omit<ThemeAppearanceStore, "setAppearance" | "applyTheme" | "hydrated">>) => void;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
}

export const useThemeAppearance = create<ThemeAppearanceStore>()(
  persist(
    (set) => ({
      themePreset: "owly-default",
      themeOverrides: {},
      themeLogoUrl: "",
      themeLogoDarkUrl: "",
      themeFaviconUrl: "",
      setAppearance: (data) => set(data),
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "owly-theme-appearance",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
