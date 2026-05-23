import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1d2433",
        mint: "#2f9d7e",
        coral: "#df6b57",
        gold: "#d99a2b"
      }
    }
  },
  plugins: []
};

export default config;

