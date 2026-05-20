import type { Config } from 'tailwindcss';
import { branding } from '@refnet/shared';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Hex values come from packages/shared/src/branding.ts. The CSS-variable
        // forms below let a downstream tenant override at runtime without a
        // rebuild — just set --color-primary on :root.
        primary: {
          DEFAULT: `var(--color-primary, ${branding.colors.primary})`,
          light: `var(--color-primary-light, ${branding.colors.primaryLight})`,
          dark: `var(--color-primary-dark, ${branding.colors.primaryDark})`,
        },
        secondary: {
          DEFAULT: `var(--color-secondary, ${branding.colors.secondary})`,
        },
        success: `var(--color-success, ${branding.colors.success})`,
        danger: `var(--color-danger, ${branding.colors.danger})`,
        warning: `var(--color-warning, ${branding.colors.warning})`,
        surface: `var(--color-surface, ${branding.colors.surface})`,
        ink: `var(--color-text, ${branding.colors.text})`,
      },
      fontFamily: {
        sans: [branding.fonts.sans, 'system-ui', 'sans-serif'],
        display: [branding.fonts.display ?? branding.fonts.sans, 'system-ui', 'sans-serif'],
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
