import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/", useRouter: () => ({push: vi.fn(),replace: vi.fn()}) }));

/**
 * راه‌اندازی محیط تست vitest (jsdom).
 * فاز ۱: فقط افزودن matcherهای jest-dom. هر mocking بعدی در همین فایل انجام می‌شود.
 */
