"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/hooks/use-theme";
import { useThemeAppearance } from "@/lib/hooks/use-theme-appearance";
import { buildThemeStyleTag } from "@/lib/theme/presets";

export function ThemeInit() {
  const { theme, setTheme } = useTheme();
  const { themePreset, themeOverridesLight, themeOverridesDark, themeMode, themeLogoUrl, themeLogoDarkUrl, themeFaviconUrl, hydrated, setAppearance } = useThemeAppearance();
  const pathname = usePathname();

  useEffect(() => {
    if (themeMode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } else {
      setTheme(themeMode);
    }
  }, [themeMode, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Fetch global settings once on mount
  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.appName) {
          setAppearance({
            appName: data.appName,
            appNameShort: data.appNameShort,
            systemName: data.systemName,
            themePreset: data.themePreset,
            themeOverridesLight: data.themeOverridesLight,
            themeOverridesDark: data.themeOverridesDark,
            themeLogoUrl: data.themeLogoUrl,
            themeLogoDarkUrl: data.themeLogoDarkUrl,
            themeFaviconUrl: data.themeFaviconUrl,
          });
        }
      })
      .catch(() => {});
  }, [setAppearance]);

  // Fetch per-user preferences — re-run on route change so it works after login
  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (prefs) {
          setAppearance({
            themePreset: prefs.themePreset || "owly-default",
            themeOverridesLight: prefs.themeOverridesLight || {},
            themeOverridesDark: prefs.themeOverridesDark || {},
            themeMode: prefs.themeMode || "system",
          });
        }
      })
      .catch(() => {});
  }, [pathname, setAppearance]);

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
      themeOverridesLight,
      themeOverridesDark,
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
  }, [themePreset, themeOverridesLight, themeOverridesDark, themeLogoUrl, themeLogoDarkUrl, themeFaviconUrl, hydrated]);

  return null;
}
