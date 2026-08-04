import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        ink: "#1A1A18",
        line: "#E4E2DD",
        muted: "#8A8780",
        accent: "#3D5A47", // deep moss — quiet, not the usual terracotta/near-black defaults
        accentSoft: "#E7ECE8",
        warn: "#B3543E",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
