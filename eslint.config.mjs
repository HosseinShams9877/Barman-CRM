import next from "eslint-config-next";

/**
 * ESLint flat config — فاز ۱.
 * پایه: پیکربندی رسمی Next (eslint-config-next 16، flat array).
 * هیچ قانون رنگ/استایلی در اینجا نیست؛ مرگ رنگ hardcoded با
 * scripts/check-hardcoded-colors.mjs بررسی می‌شود (D-05).
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "**/*.woff2",
      "coverage/**",
      // پوشه Demo فقط‌خواندنی است و هرگز بخشی از برنامه جدید نیست (CLAUDE.md §۱)
      "پلتفرم نهایی تیم بارمان/**",
    ],
  },
  ...next,
  {
    name: "barman-crm/base",
    rules: {
      // سخت‌گیری بیشتر روی مقایسه دقیق (TypeScript strict)
      eqeqeq: ["error", "always"],
    },
  },
];

export default config;
