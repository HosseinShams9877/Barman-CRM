-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT,
    "contact_id" TEXT,
    "lead_id" TEXT,
    "line" TEXT NOT NULL DEFAULT 'prod',
    "stage" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "disc_pct" INTEGER NOT NULL DEFAULT 0,
    "disc_amt" INTEGER NOT NULL DEFAULT 0,
    "ship" INTEGER NOT NULL DEFAULT 0,
    "install" INTEGER NOT NULL DEFAULT 0,
    "no_vat" BOOLEAN NOT NULL DEFAULT false,
    "valid_days" INTEGER NOT NULL DEFAULT 3,
    "note" TEXT NOT NULL DEFAULT '',
    "preset" TEXT NOT NULL DEFAULT '',
    "skipped" JSONB NOT NULL DEFAULT [],
    "plan_builder" JSONB,
    "back_note" JSONB,
    "sm_ok" JSONB,
    "mgr_ok" JSONB,
    "due" BIGINT NOT NULL DEFAULT 0,
    "stage_at" BIGINT NOT NULL DEFAULT 0,
    "times" JSONB,
    "sent" JSONB,
    "prod" JSONB,
    "prep" JSONB,
    "delivered" JSONB,
    "agreed" JSONB,
    "cancel_reason" TEXT,
    "owner_id" TEXT,
    "created_by_id" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "account_contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "void" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "by_user_id" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_payments_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_cheques" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "sayad" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "due" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'hand',
    "bank" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "order_cheques_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_stage_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "from_stage" INTEGER,
    "to_stage" INTEGER NOT NULL,
    "at" BIGINT NOT NULL,
    "by_user_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'stage',
    CONSTRAINT "order_stage_log_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_stage_log_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_handoffs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "at" BIGINT NOT NULL,
    "by_user_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "order_handoffs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "orders_account_id_idx" ON "orders"("account_id");

-- CreateIndex
CREATE INDEX "orders_lead_id_idx" ON "orders"("lead_id");

-- CreateIndex
CREATE INDEX "orders_owner_id_idx" ON "orders"("owner_id");

-- CreateIndex
CREATE INDEX "orders_stage_status_idx" ON "orders"("stage", "status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_payments_order_id_idx" ON "order_payments"("order_id");

-- CreateIndex
CREATE INDEX "order_cheques_order_id_idx" ON "order_cheques"("order_id");

-- CreateIndex
CREATE INDEX "order_stage_log_order_id_at_idx" ON "order_stage_log"("order_id", "at");

-- CreateIndex
CREATE INDEX "order_handoffs_order_id_idx" ON "order_handoffs"("order_id");
