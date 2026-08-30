import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090C",
        surface: {
          DEFAULT: "#0E1117",
          50: "#1E2430",
          100: "#161B22",
          200: "#12151C",
          300: "#0E1117",
          400: "#0A0C10",
        },
        phantom: {
          cyan: "#00F2FE",
          cyanGlow: "rgba(0, 242, 254, 0.25)",
          purple: "#9D4EDD",
          purpleGlow: "rgba(157, 78, 221, 0.25)",
          blue: "#3A86FF",
          emerald: "#10B981",
          crimson: "#EF4444",
          amber: "#F59E0B",
          slate: "#94A3B8",
          dark: "#050608",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.08)",
          glow: "rgba(0, 242, 254, 0.3)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "cyan-glow": "0 0 25px -5px rgba(0, 242, 254, 0.25)",
        "purple-glow": "0 0 25px -5px rgba(157, 78, 221, 0.25)",
        "glass-inset": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)",
      },
      animation: {
        "pulse-subtle": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-fade": "glowFade 3s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        glowFade: {
          "0%": { opacity: "0.4", filter: "blur(15px)" },
          "100%": { opacity: "0.8", filter: "blur(25px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
