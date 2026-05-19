/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          page: 'hsl(var(--surface-page))',
          elevated: 'hsl(var(--surface-elevated))',
          'elevated-hover': 'hsl(var(--surface-elevated-hover))',
        },
        txt: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          tertiary: 'hsl(var(--text-tertiary))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          hover: 'hsl(var(--accent-hover))',
          bright: 'hsl(var(--accent-bright))',
          text: 'hsl(var(--accent-text))',
        },
        border: {
          DEFAULT: 'hsl(var(--border-default))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          bright: 'hsl(var(--success-bright))',
          bg: 'hsl(var(--success-bg))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          bright: 'hsl(var(--warning-bright))',
          bg: 'hsl(var(--warning-bg))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          bright: 'hsl(var(--danger-bright))',
          bg: 'hsl(var(--danger-bg))',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
