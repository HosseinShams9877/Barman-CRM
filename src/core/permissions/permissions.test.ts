/**
 * آزمون ماتریس مجوزها و requirePermission — CD-05 / R-02.
 *
 * منبع ماتریس: AUTH_AND_PERMISSION_ARCHITECTURE §۲.۲ (بازسازی از Demo).
 */
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_MATRIX,
  ROLES,
  isNoMoneyRole,
  roleHasPermission,
  rolesHavePermission,
} from "./matrix";
import {
  hasPermission,
  listPermissions,
  listRoles,
  requireAnyPermission,
  requirePermission,
  shouldHideMoney,
} from "./requirePermission";
import { forbidden, unauthorized } from "../errors";
import type { Session } from "../auth/session";

function makeSession(roles: string[]): Session {
  return {
    userId: "u1",
    name: "ali",
    title: null,
    roles: roles as never,
    sessionVersion: 0,
    expiresAt: Date.now() + 1000,
    needsRenew: false,
  };
}

describe("ماتریس نقش‌ها (AUTH §۲.۲)", () => {
  it("۷ نقش ثابت Demo", () => {
    expect(ROLES).toEqual([
      "management",
      "admin",
      "finance",
      "salesManager",
      "sales",
      "production",
      "depot",
    ]);
  });

  it("management و admin همه مجوزها را دارند", () => {
    expect(PERMISSION_MATRIX.management).toEqual(PERMISSIONS);
    expect(PERMISSION_MATRIX.admin).toEqual(PERMISSIONS);
  });

  it("۳۶ مجوز بدون تکرار (۲۷ فاز ۱–۶ + ۹ مجوز کاتالوگ/مدیریت فاز ۷)", () => {
    expect(PERMISSIONS.length).toBe(36);
    expect(new Set(PERMISSIONS).size).toBe(36);
  });

  it("finance: خرید/مالی/گزارش/مبالغ/سفارش‌ها", () => {
    const perms = new Set(PERMISSION_MATRIX.finance);
    expect(perms.has("purchasing.view")).toBe(true);
    expect(perms.has("finance.edit")).toBe(true);
    expect(perms.has("money.view")).toBe(true);
    expect(perms.has("orders.view")).toBe(true);
    expect(perms.has("leads.view")).toBe(false);
    expect(perms.has("production.edit")).toBe(false);
  });

  it("salesManager: سرنخ/سفارش/مشتری/گزارش", () => {
    const perms = new Set(PERMISSION_MATRIX.salesManager);
    expect(perms.has("leads.viewAll")).toBe(true);
    expect(perms.has("leads.assign")).toBe(true);
    expect(perms.has("leads.import")).toBe(true);
    expect(perms.has("customers.create")).toBe(true);
    expect(perms.has("customers.view")).toBe(true);
    expect(perms.has("money.view")).toBe(true);
    expect(perms.has("admin.users")).toBe(false);
  });

  it("sales: فقط سرنخ/سفارش/مشتری بدون viewAll و assign", () => {
    const perms = new Set(PERMISSION_MATRIX.sales);
    expect(perms.has("leads.create")).toBe(true);
    expect(perms.has("leads.import")).toBe(true);
    expect(perms.has("customers.create")).toBe(true);
    expect(perms.has("orders.status.change")).toBe(true);
    expect(perms.has("leads.viewAll")).toBe(false);
    expect(perms.has("leads.assign")).toBe(false);
    expect(perms.has("money.view")).toBe(false);
  });

  it("finance: دسترسی سرنخ ندارد ولی مشتریان را می‌بیند (فاز ۳ + فاز ۷)", () => {
    const perms = new Set(PERMISSION_MATRIX.finance);
    expect(perms.has("leads.view")).toBe(false);
    expect(perms.has("leads.import")).toBe(false);
    // فاز ۷: تب مشتریان و تأمین‌کننده‌ها در مدیریت (admin.js:11-12).
    expect(perms.has("customers.view")).toBe(true);
    expect(perms.has("customers.edit")).toBe(true);
    expect(perms.has("catalog.suppliers.edit")).toBe(true);
  });

  it("فاز ۷: ماتریس SEE/EDIT مدیریت (app/admin.js:9-13)", () => {
    // products: همه می‌بینند، فقط admin/management ویرایش می‌کنند.
    for (const role of ROLES) {
      expect(roleHasPermission(role, "catalog.products.read")).toBe(true);
    }
    expect(roleHasPermission("sales", "catalog.products.edit")).toBe(false);
    expect(roleHasPermission("production", "catalog.products.edit")).toBe(false);

    // materials/bom: فقط مدیران و تولید.
    expect(roleHasPermission("production", "catalog.materials.read")).toBe(true);
    expect(roleHasPermission("production", "catalog.bom.edit")).toBe(true);
    expect(roleHasPermission("sales", "catalog.materials.read")).toBe(false);
    expect(roleHasPermission("depot", "catalog.bom.read")).toBe(false);
    expect(roleHasPermission("finance", "catalog.materials.edit")).toBe(false);

    // suppliers: فقط مدیران و مالی.
    expect(roleHasPermission("finance", "catalog.suppliers.read")).toBe(true);
    expect(roleHasPermission("production", "catalog.suppliers.read")).toBe(false);

    // users/lists/settings: فقط admin/management (FULL در admin.js:9).
    expect(roleHasPermission("sales", "admin.lists")).toBe(false);
    expect(roleHasPermission("finance", "admin.users")).toBe(false);
    expect(roleHasPermission("management", "admin.lists")).toBe(true);
  });

  it("production: سفارش/تولید/موجودی بدون مبالغ", () => {
    const perms = new Set(PERMISSION_MATRIX.production);
    expect(perms.has("production.edit")).toBe(true);
    expect(perms.has("inventory.view")).toBe(true);
    expect(perms.has("money.view")).toBe(false);
  });

  it("depot: موجودی و حرکات انبار", () => {
    const perms = new Set(PERMISSION_MATRIX.depot);
    expect(perms.has("inventory.moves")).toBe(true);
    expect(perms.has("inventory.view")).toBe(true);
    expect(perms.has("money.view")).toBe(false);
  });
});

describe("roleHasPermission / rolesHavePermission", () => {
  it("بررسی تک‌نقشی", () => {
    expect(roleHasPermission("admin", "admin.settings")).toBe(true);
    expect(roleHasPermission("sales", "admin.settings")).toBe(false);
    expect(roleHasPermission("ghost" as never, "leads.view")).toBe(false);
  });

  it("بررسی چندنقشی", () => {
    expect(rolesHavePermission(["sales", "production"], "production.view")).toBe(true);
    // production در فاز ۶ دید خرید/مالی بدون مبلغ دریافت می‌کند (R-32)
    expect(rolesHavePermission(["production"], "finance.view")).toBe(true);
    expect(rolesHavePermission(["sales"], "finance.view")).toBe(false);
    expect(rolesHavePermission([], "leads.view")).toBe(false);
  });
});

describe("noMoney (R-32)", () => {
  it("production و depot نباید مبالغ ببینند", () => {
    expect(isNoMoneyRole(["production"])).toBe(true);
    expect(isNoMoneyRole(["depot"])).toBe(true);
  });

  it("نقش‌های دیگر مجوز money.view دارند", () => {
    expect(isNoMoneyRole(["admin"])).toBe(false);
    expect(isNoMoneyRole(["finance"])).toBe(false);
    expect(isNoMoneyRole(["salesManager"])).toBe(false);
  });

  it("ترکیب نقش: یک نقش با مجوز کافی است", () => {
    expect(isNoMoneyRole(["production", "finance"])).toBe(false);
  });

  it("shouldHideMoney بر اساس نشست", () => {
    expect(shouldHideMoney(makeSession(["depot"]))).toBe(true);
    expect(shouldHideMoney(makeSession(["admin"]))).toBe(false);
  });
});

describe("requirePermission — اجرای سرور", () => {
  it("نشست null → ۴۰۱", () => {
    try {
      requirePermission(null, "orders.view");
      throw new Error("نباید به اینجا برسد");
    } catch (e) {
      expect(e).toBeInstanceOf(unauthorized().constructor);
      expect((e as { status: number }).status).toBe(401);
    }
  });

  it("بدون مجوز → ۴۰۳ (R-02)", () => {
    try {
      requirePermission(makeSession(["sales"]), "admin.users");
      throw new Error("نباید به اینجا برسد");
    } catch (e) {
      expect(e).toBeInstanceOf(forbidden().constructor);
      expect((e as { status: number }).status).toBe(403);
    }
  });

  it("با مجوز → استثنا پرتاب نمی‌شود", () => {
    expect(() => requirePermission(makeSession(["admin"]), "admin.users")).not.toThrow();
    expect(() => requirePermission(makeSession(["sales"]), "leads.create")).not.toThrow();
  });

  it("چندنقشی: یکی از نقش‌ها کافی است", () => {
    const session = makeSession(["sales", "production"]);
    expect(() => requirePermission(session, "production.view")).not.toThrow();
    // sales بدون مجوز خرید/مالی است (برخلاف production که فاقد money.view است)
    expect(() => requirePermission(makeSession(["sales"]), "finance.view")).toThrow();
  });

  it("requireAnyPermission: حداقل یکی", () => {
    const session = makeSession(["production"]);
    expect(() => requireAnyPermission(session, ["finance.view", "inventory.view"])).not.toThrow();
    expect(() => requireAnyPermission(session, ["money.view", "admin.users"])).toThrow();
  });

  it("hasPermission boolean برمی‌گرداند", () => {
    expect(hasPermission(makeSession(["sales"]), "leads.view")).toBe(true);
    expect(hasPermission(makeSession(["sales"]), "leads.viewAll")).toBe(false);
    expect(hasPermission(null, "leads.view")).toBe(false);
  });
});

describe("listRoles / listPermissions", () => {
  it("نقش‌های session فعلی و همه مجوزهای admin", () => {
    expect(listRoles(makeSession(["admin"]))).toEqual(["admin"]);
    // admin همه ۲۱ مجوز را دارد — ترتیب همان PERMISSIONS است
    expect(listPermissions(makeSession(["admin"]))).toEqual([...PERMISSIONS]);
    expect(listRoles(makeSession(["sales", "admin"]))).toEqual(["admin", "sales"]);
  });

  it("مجوزهای sales شامل money.view نیست (R-32)", () => {
    expect(listPermissions(makeSession(["sales"]))).not.toContain("money.view");
    expect(listPermissions(makeSession(["sales"])).length).toBe(13);
  });

  it("بدون نشست → آرایه خالی", () => {
    expect(listRoles(null)).toEqual([]);
    expect(listPermissions(null)).toEqual([]);
  });
});
