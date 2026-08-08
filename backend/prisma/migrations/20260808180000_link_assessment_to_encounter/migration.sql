-- Corte 3 (ClinicalEncounter ↔ Assessment): columna aditiva y nullable.
-- Ningún Assessment existente cambia -- todos quedan con encounterId = NULL,
-- que es exactamente su estado "histórico/standalone" permanente. No hay
-- backfill, no hay inferencia por fecha/patientId, no hay creación
-- automática de ClinicalEncounter. Postgres permite múltiples NULL bajo
-- UNIQUE, así que los Assessment standalone existentes (y futuros) coexisten
-- sin conflicto con el nuevo índice único.

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "encounterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_encounterId_key" ON "Assessment"("encounterId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
