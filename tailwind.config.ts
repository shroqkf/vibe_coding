import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        toss: {
          blue: "#3182F6",
          "blue-dark": "#1B64DA",
          "blue-light": "#EFF6FF",
          red: "#F04452",
          gray: {
            50: "#F9FAFB",
            100: "#F2F4F6",
            200: "#E5E8EB",
            300: "#D1D6DB",
            400: "#B0B8C1",
            500: "#8B95A1",
            600: "#6B7684",
            700: "#4E5968",
            800: "#333D4B",
            900: "#191F28",
          },
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        toss: "0 2px 8px rgba(25, 31, 40, 0.04), 0 1px 2px rgba(25, 31, 40, 0.04)",
        "toss-lg": "0 8px 24px rgba(25, 31, 40, 0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
