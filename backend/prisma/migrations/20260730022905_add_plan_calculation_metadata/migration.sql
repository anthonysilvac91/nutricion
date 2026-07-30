-- AlterTable
ALTER TABLE "NutritionalPlan" ADD COLUMN     "calculatedAt" TIMESTAMP(3),
ADD COLUMN     "calculationMetadata" JSONB;
