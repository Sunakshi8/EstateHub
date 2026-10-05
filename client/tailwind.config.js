/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf4f1",
          100: "#fbe7e0",
          500: "#b5442e",
          600: "#963a27",
          700: "#7a2f20",
        },
      },
    },
  },
  plugins: [],
};
