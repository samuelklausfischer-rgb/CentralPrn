/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        prn: {
          blue:   '#0D2B55',
          bluem:  '#1A4A8A',
          orange: '#F26522',
        },
      },
    },
  },
  plugins: [],
}
