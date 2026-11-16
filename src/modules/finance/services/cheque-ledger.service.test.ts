import { describe, expect, it, vi } from "vitest";
vi.mock("@core/database/client", () => ({ prisma: { orderCheque: { findMany: vi.fn() }, buyCheque: { findMany: vi.fn() } } }));
import { prisma } from "@core/database/client";
import { listFinanceCheques } from "./cheque-ledger.service";
describe("دفتر چک", () => {
  it("چک وصول‌شده را در سابقه نگه می‌دارد؛ noMoney مبلغ ندارد", async () => {
    vi.mocked(prisma.orderCheque.findMany).mockResolvedValue([{ id: "c1", orderId: "PF-1", status: "clear", amount: 900, sayad: "", bank: "", owner: "", due: "1405/09/01", order: { account: { name: "مشتری" } } }] as never);
    const data = await listFinanceCheques("rec", true);
    expect(data.items[0]).toMatchObject({ status: "clear", documentId: "PF-1", party: "مشتری" });
    expect(data.items[0]).not.toHaveProperty("amount");
  });
  it("سوابق پرداخت چک صادره و فروشنده را نمایش می‌دهد", async () => {
    vi.mocked(prisma.buyCheque.findMany).mockResolvedValue([{ id: "c2", buyId: "BY-1", status: "paid", amount: 800, sayad: null, due: "1405/09/01", buy: { supplier: { name: "فروشنده" } } }] as never);
    const data = await listFinanceCheques("pay", false);
    expect(data.items[0]).toMatchObject({ status: "paid", documentId: "BY-1", party: "فروشنده", amount: 800, bank: "" });
  });
});
