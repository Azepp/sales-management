CREATE TYPE "ExpenseType" AS ENUM ('production_material', 'operational', 'unclassified');

ALTER TABLE "Expense"
ADD COLUMN "type" "ExpenseType" NOT NULL DEFAULT 'unclassified';
