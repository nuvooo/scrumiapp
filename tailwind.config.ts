import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080B11",
        panel: "#0E1218",
        field: "#0F131B",
        chip: "#12161F",
        raise: "#141A25",
        navhover: "#141924",
        cell: "#1B2233",
        line: "#1C2231",
        row: "#181E2A",
        edge: "#242D3D",
        tipbg: "#161B26",
        tipline: "#2A3345",
        fg: "#E7EBF3",
        soft: "#D2D9E6",
        mid: "#A8B2C6",
        muted: "#8B95AB",
        dim: "#7E889E",
        faint: "#56607A",
        accent: "#7C9CFF",
        accenthi: "#9DB5FF",
        link: "#8CA6FF",
        linkhi: "#AFC1FF",
        ok: "#4ADE80",
        warn: "#F2A65A",
        danger: "#F2555A",
        mint: "#5EEAD4",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      boxShadow: {
        card: "inset 0 1px 0 rgba(255,255,255,0.035), 0 1px 2px rgba(0,0,0,0.45)",
        btn: "inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 16px rgba(124,156,255,0.26)",
        tip: "0 8px 24px rgba(0,0,0,0.45)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
