import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark theme palette
        paper:      "#0E0E12",   // near-black base
        surface:    "#16161C",   // card/row surface
        surfaceHov: "#1E1E26",   // hovered row
        line:       "#2A2A35",   // borders
        muted:      "#5A5A72",   // de-emphasised text
        soft:       "#8888A8",   // secondary text
        bright:     "#E8E8F0",   // primary text
        // Gradient stops — purple → teal
        gradA:      "#7C6FCD",   // violet
        gradB:      "#4ABFBF",   // teal
        // Status
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
