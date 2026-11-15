-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "off" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "password_salt" TEXT,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "roles" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,

    PRIMARY KEY ("user_id", "role_key"),
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_role_key_fkey" FOREIGN KEY ("role_key") REFERENCES "roles" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 0,
    "vat" INTEGER NOT NULL DEFAULT 0,
    "valid_days" INTEGER NOT NULL DEFAULT 0,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "discount_cap" JSONB NOT NULL,
    "company" JSONB NOT NULL,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "rev" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "rev" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "days" INTEGER NOT NULL DEFAULT 0,
    "supplier_id" TEXT,
    "colors" JSONB NOT NULL DEFAULT [],
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "rev" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "min" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "rev" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "bom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    CONSTRAINT "bom_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bom_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL DEFAULT [],
    "created_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "rev" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "lists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT [],
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "rev" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE INDEX "user_roles_role_key_idx" ON "user_roles"("role_key");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE INDEX "bom_material_id_idx" ON "bom"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_product_id_material_id_key" ON "bom"("product_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "lists_key_key" ON "lists"("key");
