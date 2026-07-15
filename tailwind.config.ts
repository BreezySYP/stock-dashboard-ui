import type { Config } from "tailwindcss";
import daisyui from "daisyui"; // ← 改成 import

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [daisyui], // ← 不用 require
  daisyui: {
    themes: ["light"],
    darkTheme: "night",
    base: true,
    styled: true,
    utils: true,
  },
} satisfies Config;
