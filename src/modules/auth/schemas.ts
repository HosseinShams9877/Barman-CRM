/**
 * اسکیمای مشترک احراز هویت — اعتبارسنجی دوگانه (R-13).
 */
import { z } from "zod";

/** ورود — نام و رمز اجباری. نام نباید خالی باشد. */
export const loginSchema = z.object({
  name: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});
