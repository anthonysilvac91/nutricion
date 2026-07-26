/*
  Warnings:

  - Added the required column `assessmentId` to the `NutritionalPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `calculationResults` to the `NutritionalPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `engineVersion` to the `NutritionalPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceSnapshot` to the `NutritionalPlan` table without a default value. This is not possible if the table is not empty.

*/

-- Pre-production cleanup: existing plans predate Assessment linkage and
-- carried unvalidated client JSON with no calculation provenance. Per
-- product decision, they are not backfilled or preserved.
TRUNCATE TABLE "NutritionalPlan";

-- AlterTable
ALTER TABLE "NutritionalPlan" ADD COLUMN     "assessmentId" TEXT NOT NULL,
ADD COLUMN     "calculationResults" JSONB NOT NULL,
ADD COLUMN     "engineVersion" TEXT NOT NULL,
ADD COLUMN     "sourceSnapshot" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "NutritionalPlan_assessmentId_idx" ON "NutritionalPlan"("assessmentId");

-- AddForeignKey
ALTER TABLE "NutritionalPlan" ADD CONSTRAINT "NutritionalPlan_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un solo plan DRAFT activo por paciente, forzado a nivel de base de datos.
-- Prisma no soporta índices únicos parciales en el DSL del schema (no
-- aparecerá en schema.prisma) -- no eliminar ni recrear esta migración sin
-- volver a añadir este índice a mano.
CREATE UNIQUE INDEX "NutritionalPlan_one_draft_per_patient"
  ON "NutritionalPlan" ("patientId")
  WHERE "status" = 'DRAFT';
