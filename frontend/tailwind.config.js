/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // raw oceanographic palette
        navy: "#071B2C",
        marine: "#0B3954",
        teal: "#00BFA6",
        cyan: "#5EDCE5",
        amber: "#F5B544",
        coral: "#EF6461",
        mist: "#F5F9FB",
        // semantic tokens (shadcn-style) -> map to CSS vars
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.05) inset, 0 10px 40px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(94,220,229,0.18), 0 0 40px -8px rgba(0,191,166,0.35)",
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(239,100,97,0.5)" },
          "70%": { boxShadow: "0 0 0 14px rgba(239,100,97,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239,100,97,0)" },
        },
        tide: { "0%,100%": { transform: "translateX(0)" }, "50%": { transform: "translateX(-25%)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        floatY: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        gridpan: { "0%": { backgroundPosition: "0 0" }, "100%": { backgroundPosition: "40px 40px" } },
      },
      animation: {
        pulseRing: "pulseRing 2s infinite",
        tide: "tide 14s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        floatY: "floatY 6s ease-in-out infinite",
        gridpan: "gridpan 3s linear infinite",
      },
    },
  },
  plugins: [],
};
