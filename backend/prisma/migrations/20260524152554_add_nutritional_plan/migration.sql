-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "NutritionalPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "patientValues" JSONB,
    "energyCalc" JSONB,
    "macros" JSONB,
    "micros" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NutritionalPlan_patientId_idx" ON "NutritionalPlan"("patientId");

-- CreateIndex
CREATE INDEX "NutritionalPlan_userId_idx" ON "NutritionalPlan"("userId");

-- AddForeignKey
ALTER TABLE "NutritionalPlan" ADD CONSTRAINT "NutritionalPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
