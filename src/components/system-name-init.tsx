"use client";

import { useEffect } from "react";
import { useThemeAppearance } from "@/lib/hooks/use-theme-appearance";

export function SystemNameInit() {
  const systemName = useThemeAppearance((s) => s.systemName);

  useEffect(() => {
    if (systemName) {
      document.title = systemName;
    }
  }, [systemName]);

  return null;
}
