/**
 * core/formatting — لوله انتشار (CD-02).
 *
 * فاز ۲: ارقام فارسی/انگلیسی، مبالغ، گردسازی R-08.
 * فاز ۳: نرمال‌سازی و نمایش فارسی شماره تلفن.
 */
export { toFaDigits, toEnDigits, parseFaNumber } from "./digits";
export { formatMoney, formatNumber } from "./money";
export { roundToStep, ROUND_STEP } from "./rnd";
export { normalizePhone, isValidIranPhone, formatPhoneFa } from "./phone";
