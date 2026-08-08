-- Corte 4 (ClinicalEncounter ↔ NutritionalPlan): columna aditiva y nullable.
-- Ningún NutritionalPlan existente cambia -- todos quedan con encounterId =
-- NULL, que es exactamente su estado "histórico/standalone" permanente. No
-- hay backfill, no hay inferencia por fecha/assessmentId/patientId, no hay
-- creación automática de ClinicalEncounter. Postgres permite múltiples NULL
-- bajo UNIQUE, así que los NutritionalPlan standalone existentes (y futuros)
-- coexisten sin conflicto con el nuevo índice único.

-- AlterEnum: ARCHIVED representa un borrador abandonado porque su
-- ClinicalEncounter fue descartado -- ningún plan existente pasa a este
-- estado por esta migración (ninguna fila cambia de status).
ALTER TYPE "PlanStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "NutritionalPlan" ADD COLUMN "encounterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NutritionalPlan_encounterId_key" ON "NutritionalPlan"("encounterId");

-- AddForeignKey
ALTER TABLE "NutritionalPlan" ADD CONSTRAINT "NutritionalPlan_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
