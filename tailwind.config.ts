import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Green palette
        "g50":  "#f0fdf4",
        "g100": "#dcfce7",
        "g200": "#bbf7d0",
        "g300": "#86efac",
        "g400": "#4ade80",
        "g500": "#22c55e",
        "g600": "#16a34a",
        "g700": "#15803d",
        // Neutrals
        "n50":  "#f8fafb",
        "n100": "#f1f5f2",
        "n200": "#e2e8e4",
        "n300": "#c4cfc8",
        "n400": "#8fa496",
        "n500": "#5a7362",
        "n600": "#3a5240",
        "n700": "#1e3324",
        "n800": "#0f1f14",
        "n900": "#060e09",
      },
      fontFamily: {
        sans:    ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "xl":  "12px",
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        "soft":  "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        "card":  "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        "green": "0 4px 20px rgba(34,197,94,0.25)",
        "green-lg": "0 8px 32px rgba(34,197,94,0.30)",
      },
    },
  },
  plugins: [],
};
export default config;
