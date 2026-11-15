import type { Config } from "tailwindcss";

/**
 * پیکربندی Tailwind — هیچ رنگ hardcodedی در این فایل نیست (D-05).
 * همه رنگ‌ها به توکن‌های معنایی CSS ارجاع می‌دهند و مقادیر خام فقط در
 * src/styles/globalCss/tokens.css تعریف می‌شوند.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/modules/**/*.{ts,tsx}",
    "./src/core/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        ink: "var(--color-text)",
        "ink-secondary": "var(--color-text-secondary)",
        "ink-muted": "var(--color-text-muted)",
        primary: "var(--color-primary)",
        "primary-strong": "var(--color-primary-strong)",
        "primary-subtle": "var(--color-primary-subtle)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        "stage-sales": "var(--color-stage-sales)",
        "stage-approval": "var(--color-stage-approval)",
        "stage-production": "var(--color-stage-production)",
        "stage-fulfillment": "var(--color-stage-fulfillment)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
      },
      screens: {
        xs: "480px",
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
