/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Montserrat",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          primary: "#E4032C",
          secondary: "#000000",
          accent: "#E4032C",
          background: "#F7F4F1",
          surface: "#FFFFFF",
          muted: "#6F6864",
          border: "rgba(0,0,0,0.12)",
          success: "#0F7A4A",
          warning: "#A15C00",
          danger: "#E4032C",
        },
        cockpit: {
          950: "#f7f4f1",
          900: "#ffffff",
          850: "#f1eeea",
          800: "#000000",
        },
        accent: {
          50: "#fff1f3",
          100: "#ffe1e6",
          300: "#ff8fa3",
          500: "#E4032C",
          700: "#a90220",
          900: "#5f0011",
        },
      },
      boxShadow: {
        glow: "0 1px 2px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
