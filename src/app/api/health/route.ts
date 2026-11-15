import { NextResponse } from "next/server";

/**
 * GET /api/health — سلامت برنامه.
 * مسیر عمومی: در فاز ۱ نه auth و نه مجوز وجود دارد (آنها متعلق به فاز ۲ هستند).
 * بدون منطق کسب‌کار.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", phase: 1, at: Date.now() });
}
