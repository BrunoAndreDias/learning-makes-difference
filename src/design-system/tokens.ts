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
    "Warm canvas with bright blue utility accents and calm slate text.",
} as const;

const colorTokens = {
  brand: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primarySoft: "#dbeafe",
  },
  shell: {
    canvas: "#f7f4ea",
    panel: "#fffdfa",
    inset: "#eff2f8",
  },
  content: {
    strong: "#142033",
    default: "#314158",
    muted: "#66758f",
    border: "#d7deea",
  },
  accent: {
    success: "#2f855a",
    warning: "#b7791f",
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
  outlineWidthPx: 3,
  outlineOffsetPx: 3,
  ringColor: "rgba(37, 99, 235, 0.35)",
} as const;

const shadowTokens = {
  card: "0 18px 40px rgba(20, 32, 51, 0.08)",
  chrome: "0 8px 30px rgba(20, 32, 51, 0.06)",
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
