-- CreateTable
CREATE TABLE "moves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wh" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT,
    "at" BIGINT NOT NULL,
    "by_user_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "moves_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "color" TEXT,
    "end" BIGINT,
    "status" TEXT NOT NULL,
    "good" REAL,
    "waste" REAL,
    "started_at" BIGINT,
    "qcAt" BIGINT,
    "recv_qty" REAL,
    "recvAt" BIGINT,
    "bomSnapshot" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "moves_wh_item_idx" ON "moves"("wh", "item");

-- CreateIndex
CREATE INDEX "moves_kind_idx" ON "moves"("kind");

-- CreateIndex
CREATE INDEX "moves_ref_idx" ON "moves"("ref");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_product_id_idx" ON "jobs"("product_id");
