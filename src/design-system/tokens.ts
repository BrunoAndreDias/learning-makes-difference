const layoutReferencePaths = [
  "docs/layout/no_collapse.png",
  "docs/layout/collapsed_menu_withou_focus_mode.png",
] as const;

const spacingScale = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.5rem",
  6: "2rem",
  7: "3rem",
  8: "4rem",
} as const;

const brandTokens = {
  productName: "Learning Makes Difference",
  logoSource: "docs/layout/logo.svg",
  layoutReferences: layoutReferencePaths,
  shellTone:
    "Slate White canvas with blue navigation, teal progress, amber memory, and violet creative accents.",
} as const;

const neutralColorTokens = {
  canvas: "#f8fafc",
  surface: "#ffffff",
  panel: "#f1f5f9",
  border: "#cbd5e1",
  borderSoft: "#e2e8f0",
  ink: "#0f172a",
  muted: "#475569",
} as const;

const colorTokens = {
  neutral: neutralColorTokens,
  primary: {
    value: "#2563eb",
    hover: "#1d4ed8",
    foreground: "#ffffff",
    soft: "#dbeafe",
    softBorder: "#93c5fd",
    softForeground: neutralColorTokens.ink,
  },
  secondary: {
    value: "#0f766e",
    hover: "#115e59",
    foreground: "#ffffff",
    soft: "#ccfbf1",
    softBorder: "#5eead4",
    softForeground: neutralColorTokens.ink,
  },
  accent: {
    value: "#f59e0b",
    strong: "#b45309",
    foreground: neutralColorTokens.ink,
    soft: "#fef3c7",
    softBorder: "#fcd34d",
    softForeground: neutralColorTokens.ink,
  },
  creative: {
    value: "#7c3aed",
    hover: "#6d28d9",
    foreground: "#ffffff",
    soft: "#ede9fe",
    softBorder: "#c4b5fd",
    softForeground: neutralColorTokens.ink,
  },
  semantic: {
    success: {
      value: "#15803d",
      hover: "#166534",
      foreground: "#ffffff",
      soft: "#dcfce7",
      softBorder: "#86efac",
      softForeground: neutralColorTokens.ink,
    },
    warning: {
      value: "#b45309",
      hover: "#92400e",
      foreground: "#ffffff",
      soft: "#fef3c7",
      softBorder: "#fcd34d",
      softForeground: neutralColorTokens.ink,
    },
    danger: {
      value: "#dc2626",
      hover: "#b91c1c",
      foreground: "#ffffff",
      soft: "#fee2e2",
      softBorder: "#fecaca",
      softForeground: "#991b1b",
    },
  },
  brand: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primarySoft: "#dbeafe",
  },
  shell: {
    canvas: neutralColorTokens.canvas,
    panel: neutralColorTokens.surface,
    inset: neutralColorTokens.panel,
  },
  content: {
    strong: neutralColorTokens.ink,
    default: neutralColorTokens.muted,
    muted: neutralColorTokens.muted,
    border: neutralColorTokens.border,
    borderSoft: neutralColorTokens.borderSoft,
  },
} as const;

const typographyTokens = {
  heading: {
    family: '"Sora", "Avenir Next", "Trebuchet MS", sans-serif',
    weight: 700,
    trackingEm: "-0.03em",
  },
  body: {
    family: '"Manrope", "Segoe UI", sans-serif',
    weight: 500,
    sizeRem: 1,
    lineHeight: 1.5,
  },
  label: {
    family: '"Manrope", "Segoe UI", sans-serif',
    weight: 600,
    sizeRem: 0.875,
    lineHeight: 1.4,
  },
} as const;

const radiusTokens = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  pill: "999px",
} as const;

const breakpointTokens = {
  sm: "36rem",
  md: "52rem",
  lg: "72rem",
  xl: "90rem",
} as const;

const focusTokens = {
  outlineWidthPx: 2,
  outlineOffsetPx: 2,
  outlineColor: "#0369a1",
  ringColor: "#38bdf8",
  ringWidthPx: 3,
} as const;

const shadowTokens = {
  card: "0 18px 40px rgba(15, 23, 42, 0.08)",
  chrome: "0 8px 30px rgba(15, 23, 42, 0.06)",
} as const;

const layoutTokens = {
  sidebarWidth: "18rem",
  railWidth: "4.5rem",
  contentMaxWidth: "90rem",
} as const;

export const foundationTokens = {
  brand: brandTokens,
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingScale,
  radius: radiusTokens,
  breakpoints: breakpointTokens,
  focus: focusTokens,
  shadow: shadowTokens,
  layout: layoutTokens,
} as const;

export type FoundationTokens = typeof foundationTokens;
