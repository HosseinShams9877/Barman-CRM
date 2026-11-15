-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'unknown',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "account_phones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "number" TEXT NOT NULL,
    CONSTRAINT "account_phones_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "account_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT,
    "line" TEXT NOT NULL DEFAULT 'prod',
    "stage" TEXT NOT NULL DEFAULT 'raw',
    "title" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER,
    "owner_id" TEXT,
    "source" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "lost_reason" TEXT,
    "lost_from" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "leads_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_followups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "at" BIGINT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "result" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "next_at" TEXT,
    "by_user_id" TEXT,
    CONSTRAINT "lead_followups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_interest" (
    "lead_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    PRIMARY KEY ("lead_id", "product_id"),
    CONSTRAINT "lead_interest_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_interest_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "accounts_active_idx" ON "accounts"("active");

-- CreateIndex
CREATE INDEX "account_phones_account_id_idx" ON "account_phones"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_phones_account_id_number_key" ON "account_phones"("account_id", "number");

-- CreateIndex
CREATE INDEX "account_contacts_account_id_idx" ON "account_contacts"("account_id");

-- CreateIndex
CREATE INDEX "leads_line_stage_idx" ON "leads"("line", "stage");

-- CreateIndex
CREATE INDEX "leads_owner_id_idx" ON "leads"("owner_id");

-- CreateIndex
CREATE INDEX "leads_account_id_idx" ON "leads"("account_id");

-- CreateIndex
CREATE INDEX "lead_followups_lead_id_at_idx" ON "lead_followups"("lead_id", "at");

-- CreateIndex
CREATE INDEX "lead_interest_product_id_idx" ON "lead_interest"("product_id");
