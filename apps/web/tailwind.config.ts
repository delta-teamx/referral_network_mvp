import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design tokens from spec
        primary: {
          DEFAULT: '#1B5E8C',
          light: '#E8F2FA',
        },
        secondary: {
          DEFAULT: '#E8913A',
        },
        success: '#2E7D32',
        danger: '#D32F2F',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
