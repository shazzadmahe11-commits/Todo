import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark theme
        paper:      "#0E0E12",
        surface:    "#16161C",
        surfaceHov: "#1E1E26",
        line:       "#2A2A35",
        muted:      "#5A5A72",
        soft:       "#8888A8",
        bright:     "#E8E8F0",
        gradA:      "#7C6FCD",
        gradB:      "#4ABFBF",
        warn:       "#E07060",
        warnSoft:   "#3A1F1A",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body:    ["var(--font-body)"],
        mono:    ["var(--font-mono)"],
      },
      borderRadius: {
        sm:      "4px",
        DEFAULT: "6px",
      },
      backgroundImage: {
        "grad":        "linear-gradient(135deg, #7C6FCD 0%, #4ABFBF 100%)",
        "grad-subtle": "linear-gradient(135deg, rgba(124,111,205,0.15) 0%, rgba(74,191,191,0.15) 100%)",
        "grad-text":   "linear-gradient(90deg, #7C6FCD 0%, #4ABFBF 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
