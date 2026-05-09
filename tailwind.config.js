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
          primary: "#111827",
          secondary: "#000000",
          accent: "#2563EB",
          background: "#F7F4F1",
          surface: "#FFFFFF",
          muted: "#6F6864",
          border: "rgba(0,0,0,0.12)",
          success: "#0F7A4A",
          warning: "#A15C00",
          danger: "#B91C1C",
        },
        cockpit: {
          950: "#f7f4f1",
          900: "#ffffff",
          850: "#f1eeea",
          800: "#000000",
        },
        focus: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          300: "#93C5FD",
          500: "#2563EB",
          700: "#1D4ED8",
          900: "#1E3A8A",
        },
      },
      boxShadow: {
        glow: "0 1px 2px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
