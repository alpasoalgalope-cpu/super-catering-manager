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
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#4F46E5", // Indigo 600
          hover: "#4338CA", // Indigo 700
        },
        surface: {
          DEFAULT: "#1F2937", // Gray 800
          elevated: "#374151", // Gray 700
        }
      },
    },
  },
  plugins: [],
};
export default config;
