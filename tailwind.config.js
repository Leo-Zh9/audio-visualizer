/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Main palette
        bg: {
          DEFAULT: '#ffffff',
          secondary: '#f8f9fa',
        },
        text: {
          main: '#151515',
          muted: '#7a7a7a',
          subtle: 'rgba(0, 0, 0, 0.35)',
        },
        accent: {
          DEFAULT: '#f5b948',
          hover: '#e8a935',
        },
        // Semantic colors
        glass: 'rgba(255, 255, 255, 0.7)',
        border: {
          light: 'rgba(0, 0, 0, 0.06)',
          medium: 'rgba(0, 0, 0, 0.12)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'Fira Sans',
          'Droid Sans',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'Courier New',
          'monospace',
        ],
      },
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      blur: {
        xs: '2px',
        glass: '20px',
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
}
