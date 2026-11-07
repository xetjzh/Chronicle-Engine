const accent = {
  50: '#faf6ed', 100: '#f2e7cf', 200: '#e8d3aa', 300: '#dfc38e',
  400: '#d0ad70', 500: '#916c35', 600: '#805d2c', 700: '#684c29',
  800: '#533e27', 900: '#382e22', 950: '#252119',
};

module.exports = {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: accent,
        purple: accent,
        indigo: accent,
        slate: {
          50: '#faf7f0', 100: '#f0eadf', 200: '#e1dbcf', 300: '#cec8bc',
          400: '#b2aea4', 500: '#96958c', 600: '#6f716b', 700: '#444643',
          800: '#30332f', 900: '#1d211f', 950: '#131715',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'STSong', 'Songti SC', 'SimSun', 'serif'],
        display: ['Cinzel', '"Noto Serif SC"', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
