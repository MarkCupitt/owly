"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/hooks/use-theme";
import { useThemeAppearance } from "@/lib/hooks/use-theme-appearance";
import { buildThemeStyleTag } from "@/lib/theme/presets";

export function ThemeInit() {
  const { theme } = useTheme();
  const { themePreset, themeOverrides, themeLogoUrl, themeLogoDarkUrl, themeFaviconUrl, hydrated } = useThemeAppearance();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;

    const styleId = "owly-theme-override";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const css = buildThemeStyleTag(
      themePreset,
      themeOverrides,
      { logoUrl: themeLogoUrl, logoDarkUrl: themeLogoDarkUrl, faviconUrl: themeFaviconUrl }
    );
    styleEl.textContent = css;

    if (themeFaviconUrl) {
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.rel = "icon";
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = themeFaviconUrl;
    }
  }, [themePreset, themeOverrides, themeLogoUrl, themeLogoDarkUrl, themeFaviconUrl, hydrated]);

  return null;
}
