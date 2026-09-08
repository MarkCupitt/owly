export interface ThemeColors {
  "--owly-primary": string;
  "--owly-primary-dark": string;
  "--owly-primary-light": string;
  "--owly-primary-50": string;
  "--owly-primary-100": string;
  "--owly-accent": string;
  "--owly-accent-light": string;
  "--owly-bg": string;
  "--owly-surface": string;
  "--owly-text": string;
  "--owly-text-light": string;
  "--owly-border": string;
  "--owly-sidebar": string;
  "--owly-sidebar-hover": string;
  "--owly-sidebar-active": string;
  "--owly-success": string;
  "--owly-warning": string;
  "--owly-danger": string;
}

export interface ThemeAssets {
  logoUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  assets?: ThemeAssets;
}

const owlyDefaultLight: ThemeColors = {
  "--owly-primary": "#4A7C9B",
  "--owly-primary-dark": "#2D5A7B",
  "--owly-primary-light": "#A8D0E6",
  "--owly-primary-50": "#EDF5FA",
  "--owly-primary-100": "#D6E8F2",
  "--owly-accent": "#C4956A",
  "--owly-accent-light": "#E0C4A8",
  "--owly-bg": "#F8FAFC",
  "--owly-surface": "#FFFFFF",
  "--owly-text": "#1E293B",
  "--owly-text-light": "#64748B",
  "--owly-border": "#E2E8F0",
  "--owly-sidebar": "#1E293B",
  "--owly-sidebar-hover": "#334155",
  "--owly-sidebar-active": "#4A7C9B",
  "--owly-success": "#22C55E",
  "--owly-warning": "#F59E0B",
  "--owly-danger": "#EF4444",
};

const owlyDefaultDark: ThemeColors = {
  "--owly-primary": "#5A9CBB",
  "--owly-primary-dark": "#4A8CAB",
  "--owly-primary-light": "#3A6C8B",
  "--owly-primary-50": "#1A2A3A",
  "--owly-primary-100": "#1E3448",
  "--owly-accent": "#D4A57A",
  "--owly-accent-light": "#4A3A2A",
  "--owly-bg": "#0F172A",
  "--owly-surface": "#1E293B",
  "--owly-text": "#F1F5F9",
  "--owly-text-light": "#94A3B8",
  "--owly-border": "#334155",
  "--owly-sidebar": "#0F172A",
  "--owly-sidebar-hover": "#1E293B",
  "--owly-sidebar-active": "#4A7C9B",
  "--owly-success": "#22C55E",
  "--owly-warning": "#F59E0B",
  "--owly-danger": "#EF4444",
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "owly-default",
    name: "Owly Default",
    colors: { light: owlyDefaultLight, dark: owlyDefaultDark },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      light: {
        "--owly-primary": "#16A34A",
        "--owly-primary-dark": "#15803D",
        "--owly-primary-light": "#86EFAC",
        "--owly-primary-50": "#F0FDF4",
        "--owly-primary-100": "#DCFCE7",
        "--owly-accent": "#F59E0B",
        "--owly-accent-light": "#FCD34D",
        "--owly-bg": "#F8FAFC",
        "--owly-surface": "#FFFFFF",
        "--owly-text": "#1E293B",
        "--owly-text-light": "#64748B",
        "--owly-border": "#E2E8F0",
        "--owly-sidebar": "#14532D",
        "--owly-sidebar-hover": "#166534",
        "--owly-sidebar-active": "#16A34A",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
      dark: {
        "--owly-primary": "#4ADE80",
        "--owly-primary-dark": "#22C55E",
        "--owly-primary-light": "#166534",
        "--owly-primary-50": "#0A1F0F",
        "--owly-primary-100": "#0F2914",
        "--owly-accent": "#FBBF24",
        "--owly-accent-light": "#4A3A0A",
        "--owly-bg": "#0A0F0A",
        "--owly-surface": "#0F1A0F",
        "--owly-text": "#F1F5F9",
        "--owly-text-light": "#94A3B8",
        "--owly-border": "#1F3320",
        "--owly-sidebar": "#0A0F0A",
        "--owly-sidebar-hover": "#0F1A0F",
        "--owly-sidebar-active": "#16A34A",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      light: {
        "--owly-primary": "#E85D04",
        "--owly-primary-dark": "#C2410C",
        "--owly-primary-light": "#FDBA74",
        "--owly-primary-50": "#FFF7ED",
        "--owly-primary-100": "#FFEDD5",
        "--owly-accent": "#D9ED92",
        "--owly-accent-light": "#BEF264",
        "--owly-bg": "#F8FAFC",
        "--owly-surface": "#FFFFFF",
        "--owly-text": "#1E293B",
        "--owly-text-light": "#64748B",
        "--owly-border": "#E2E8F0",
        "--owly-sidebar": "#7B2D26",
        "--owly-sidebar-hover": "#9A3412",
        "--owly-sidebar-active": "#E85D04",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
      dark: {
        "--owly-primary": "#FB923C",
        "--owly-primary-dark": "#E85D04",
        "--owly-primary-light": "#7B2D26",
        "--owly-primary-50": "#1A0F0A",
        "--owly-primary-100": "#1F120F",
        "--owly-accent": "#BEF264",
        "--owly-accent-light": "#4A3A0A",
        "--owly-bg": "#0F0A0A",
        "--owly-surface": "#1A0F0F",
        "--owly-text": "#F1F5F9",
        "--owly-text-light": "#94A3B8",
        "--owly-border": "#331A1A",
        "--owly-sidebar": "#0F0A0A",
        "--owly-sidebar-hover": "#1A0F0F",
        "--owly-sidebar-active": "#E85D04",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    colors: {
      light: {
        "--owly-primary": "#7C3AED",
        "--owly-primary-dark": "#6D28D9",
        "--owly-primary-light": "#C4B5FD",
        "--owly-primary-50": "#F5F3FF",
        "--owly-primary-100": "#EDE9FE",
        "--owly-accent": "#FBBF24",
        "--owly-accent-light": "#FCD34D",
        "--owly-bg": "#F8FAFC",
        "--owly-surface": "#FFFFFF",
        "--owly-text": "#1E293B",
        "--owly-text-light": "#64748B",
        "--owly-border": "#E2E8F0",
        "--owly-sidebar": "#2E1065",
        "--owly-sidebar-hover": "#4C1D95",
        "--owly-sidebar-active": "#7C3AED",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
      dark: {
        "--owly-primary": "#A78BFA",
        "--owly-primary-dark": "#7C3AED",
        "--owly-primary-light": "#4C1D95",
        "--owly-primary-50": "#0F0A1A",
        "--owly-primary-100": "#140F24",
        "--owly-accent": "#FBBF24",
        "--owly-accent-light": "#4A3A0A",
        "--owly-bg": "#0A0A14",
        "--owly-surface": "#0F0F1A",
        "--owly-text": "#F1F5F9",
        "--owly-text-light": "#94A3B8",
        "--owly-border": "#1F1F33",
        "--owly-sidebar": "#0A0A14",
        "--owly-sidebar-hover": "#0F0F1A",
        "--owly-sidebar-active": "#7C3AED",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
    },
  },
  {
    id: "mono",
    name: "Mono",
    colors: {
      light: {
        "--owly-primary": "#334155",
        "--owly-primary-dark": "#1E293B",
        "--owly-primary-light": "#94A3B8",
        "--owly-primary-50": "#F1F5F9",
        "--owly-primary-100": "#E2E8F0",
        "--owly-accent": "#64748B",
        "--owly-accent-light": "#94A3B8",
        "--owly-bg": "#F8FAFC",
        "--owly-surface": "#FFFFFF",
        "--owly-text": "#1E293B",
        "--owly-text-light": "#64748B",
        "--owly-border": "#E2E8F0",
        "--owly-sidebar": "#0F172A",
        "--owly-sidebar-hover": "#1E293B",
        "--owly-sidebar-active": "#334155",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
      dark: {
        "--owly-primary": "#94A3B8",
        "--owly-primary-dark": "#64748B",
        "--owly-primary-light": "#334155",
        "--owly-primary-50": "#0F0F14",
        "--owly-primary-100": "#14141E",
        "--owly-accent": "#64748B",
        "--owly-accent-light": "#334155",
        "--owly-bg": "#0A0A0F",
        "--owly-surface": "#0F0F14",
        "--owly-text": "#F1F5F9",
        "--owly-text-light": "#94A3B8",
        "--owly-border": "#1E1E2E",
        "--owly-sidebar": "#0A0A0F",
        "--owly-sidebar-hover": "#0F0F14",
        "--owly-sidebar-active": "#334155",
        "--owly-success": "#22C55E",
        "--owly-warning": "#F59E0B",
        "--owly-danger": "#EF4444",
      },
    },
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function resolveThemeColors(
  presetId: string,
  overrides: Record<string, string> = {},
  mode: "light" | "dark"
): ThemeColors {
  const preset = getPresetById(presetId) || getPresetById("owly-default")!;
  const base = preset.colors[mode];
  return { ...base, ...overrides };
}

export function formatCssVars(colors: ThemeColors): string {
  return Object.entries(colors)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n  ");
}

export function buildThemeStyleTag(
  presetId: string,
  overridesLight: Record<string, string> = {},
  overridesDark: Record<string, string> = {},
  _assets: ThemeAssets = {}
): string {
  const lightColors = resolveThemeColors(presetId, overridesLight, "light");
  const darkColors = resolveThemeColors(presetId, overridesDark, "dark");

  let css = `:root {\n  ${formatCssVars(lightColors)}\n}`;
  css += `\n.dark {\n  ${formatCssVars(darkColors)}\n}`;

  return css;
}
