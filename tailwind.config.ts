import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0B1F4B",
        "navy-muted": "#3B4A6B",
        slate: "#69799E",
        "brand-red": "#D62839",
        blue: "#1D4ED8",
        surface: "#FFFFFF",
        panel: "#EEF3FF",
        border: "#D5E0FA",
        "border-dashed": "#9AAACF",
        severity: {
          critical: {
            bg: "#FDE8EA",
            border: "#F8CED3",
            text: "#7A0F1C",
            label: "#D62839",
          },
          attention: {
            bg: "#FEF3E2",
            border: "#F6D9A8",
            text: "#7C2D12",
            label: "#B45309",
          },
          missing: {
            bg: "#FFFFFF",
            border: "#9AAACF",
            text: "#3B4A6B",
          },
          normal: {
            bg: "#FFFFFF",
            border: "#D5E0FA",
            text: "#0B1F4B",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
