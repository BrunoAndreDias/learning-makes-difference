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
    "Warm ivory canvas with pine navigation, teal progress, amber memory, and moss creative accents.",
} as const;

const neutralColorTokens = {
  canvas: "#FAF8F3",
  surface: "#ffffff",
  panel: "#E9F2EC",
  border: "#D8D1C6",
  borderSoft: "#E6E1D8",
  ink: "#17231E",
  muted: "#62706A",
} as const;

const learningColorTokens = {
  amberMist: "#FFF4DE",
  borderStone: "#E6E1D8",
  deepPine: "#1F6B45",
  deepPineHover: "#185A39",
  factualTeal: "#287C73",
  honeyAmber: "#D99126",
  ink: "#17231E",
  leafSuccess: "#2F8A53",
  moss: "#6F7B4B",
  muted: "#62706A",
  pineMist: "#E9F2EC",
  sageFocus: "#6E9279",
  surface: "#FFFFFF",
  tealMist: "#EAF6F4",
  terracotta: "#C95646",
  terracottaMist: "#FBECEA",
  warmIvory: "#FAF8F3",
} as const;

const colorTokens = {
  neutral: neutralColorTokens,
  learning: learningColorTokens,
  primary: {
    value: learningColorTokens.deepPine,
    hover: learningColorTokens.deepPineHover,
    foreground: "#ffffff",
    soft: learningColorTokens.pineMist,
    softBorder: "#B8CCBE",
    softForeground: neutralColorTokens.ink,
  },
  secondary: {
    value: learningColorTokens.factualTeal,
    hover: "#21695F",
    foreground: "#ffffff",
    soft: learningColorTokens.tealMist,
    softBorder: "#A7D7D0",
    softForeground: neutralColorTokens.ink,
  },
  accent: {
    value: learningColorTokens.honeyAmber,
    strong: "#9B5F08",
    foreground: neutralColorTokens.ink,
    soft: learningColorTokens.amberMist,
    softBorder: "#E7BE70",
    softForeground: neutralColorTokens.ink,
  },
  creative: {
    value: learningColorTokens.moss,
    hover: "#5B673B",
    foreground: "#ffffff",
    soft: "#EEF2E3",
    softBorder: "#C7D1A7",
    softForeground: neutralColorTokens.ink,
  },
  semantic: {
    success: {
      value: learningColorTokens.deepPine,
      hover: learningColorTokens.deepPineHover,
      foreground: "#ffffff",
      soft: learningColorTokens.pineMist,
      softBorder: "#B8CCBE",
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
      value: "#B42318",
      hover: "#931B12",
      foreground: "#ffffff",
      soft: learningColorTokens.terracottaMist,
      softBorder: "#E5A69F",
      softForeground: "#8B1E17",
    },
  },
  brand: {
    primary: learningColorTokens.deepPine,
    primaryHover: learningColorTokens.deepPineHover,
    primarySoft: learningColorTokens.pineMist,
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
  outlineColor: learningColorTokens.deepPine,
  ringColor: learningColorTokens.sageFocus,
  ringWidthPx: 3,
} as const;

const shadowTokens = {
  card: "0 18px 40px rgba(23, 35, 30, 0.08)",
  chrome: "0 8px 30px rgba(23, 35, 30, 0.06)",
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
