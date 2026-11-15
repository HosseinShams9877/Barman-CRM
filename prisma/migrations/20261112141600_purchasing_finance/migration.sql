-- CreateTable
CREATE TABLE "buys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplier_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'req',
    "total" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "buys_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "buys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "buy_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buy_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "price" INTEGER NOT NULL,
    CONSTRAINT "buy_items_buy_id_fkey" FOREIGN KEY ("buy_id") REFERENCES "buys" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "buy_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "buy_cheques" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buy_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due" TEXT NOT NULL,
    "sayad" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    CONSTRAINT "buy_cheques_buy_id_fkey" FOREIGN KEY ("buy_id") REFERENCES "buys" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "buy_status_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buy_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "at" BIGINT NOT NULL,
    "by_user_id" TEXT,
    "note" TEXT,
    CONSTRAINT "buy_status_log_buy_id_fkey" FOREIGN KEY ("buy_id") REFERENCES "buys" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "buy_status_log_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "txns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "at" TEXT NOT NULL,
    "who" TEXT,
    "note" TEXT,
    "by_user_id" TEXT,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "txns_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "buys_status_idx" ON "buys"("status");

-- CreateIndex
CREATE INDEX "buys_supplier_id_idx" ON "buys"("supplier_id");

-- CreateIndex
CREATE INDEX "buy_items_buy_id_idx" ON "buy_items"("buy_id");

-- CreateIndex
CREATE INDEX "buy_items_material_id_idx" ON "buy_items"("material_id");

-- CreateIndex
CREATE INDEX "buy_cheques_buy_id_idx" ON "buy_cheques"("buy_id");

-- CreateIndex
CREATE INDEX "buy_cheques_status_idx" ON "buy_cheques"("status");

-- CreateIndex
CREATE INDEX "buy_status_log_buy_id_idx" ON "buy_status_log"("buy_id");

-- CreateIndex
CREATE INDEX "txns_at_idx" ON "txns"("at");

-- CreateIndex
CREATE INDEX "txns_kind_idx" ON "txns"("kind");

-- CreateIndex
CREATE INDEX "txns_direction_idx" ON "txns"("direction");
