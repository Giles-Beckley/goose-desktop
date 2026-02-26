/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#CCFBF1',
          100: '#99f6e4',
          200: '#5eead4',
          300: '#2dd4bf',
          400: '#14b8a6',
          500: '#0d9488',
          600: '#0F766E',
          700: '#0d6560',
          800: '#115e59',
          900: '#134e4a',
        },
        secondary: {
          DEFAULT: '#1E293B',
          light: '#334155',
        },
        accent: {
          DEFAULT: '#F97316',
          light: '#FDBA74',
        },
        goose: {
          yellow: '#FFCC00',
          green: '#CCFBF1',
          border: '#E2E8F0',
          text: '#334155',
          'text-light': '#94A3B8',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
