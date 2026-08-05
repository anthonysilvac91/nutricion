-- CreateEnum
CREATE TYPE "ClinicalProfile" AS ENUM ('ADULT_GENERAL', 'ADULT_SPORT', 'PEDIATRIC');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('FIRST_VISIT', 'FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "EncounterModule" AS ENUM ('SUMMARY', 'ANAMNESIS', 'MEASUREMENTS', 'REQUIREMENTS', 'PLANNING', 'MEAL_PLAN', 'INDICATIONS', 'REPORT', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ModuleApplicability" AS ENUM ('REQUIRED', 'OPTIONAL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "ClinicalEncounter" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "responsibleProfessionalId" TEXT NOT NULL,
    "profile" "ClinicalProfile" NOT NULL,
    "type" "EncounterType" NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "flowVersion" TEXT NOT NULL,
    "clinicalDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "consultationReason" TEXT,
    "discardReason" TEXT,
    "notes" TEXT,
    "completionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterModuleState" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "module" "EncounterModule" NOT NULL,
    "applicability" "ModuleApplicability" NOT NULL,
    "status" "ModuleStatus" NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterModuleState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalEncounter_workspaceId_status_clinicalDate_idx" ON "ClinicalEncounter"("workspaceId", "status", "clinicalDate");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_patientId_status_clinicalDate_idx" ON "ClinicalEncounter"("patientId", "status", "clinicalDate");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_responsibleProfessionalId_status_idx" ON "ClinicalEncounter"("responsibleProfessionalId", "status");

-- CreateIndex
CREATE INDEX "EncounterModuleState_encounterId_status_idx" ON "EncounterModuleState"("encounterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterModuleState_encounterId_module_key" ON "EncounterModuleState"("encounterId", "module");

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_responsibleProfessionalId_fkey" FOREIGN KEY ("responsibleProfessionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterModuleState" ADD CONSTRAINT "EncounterModuleState_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Como mucho una consulta IN_PROGRESS por paciente. Esta es la autoridad
-- definitiva contra condiciones de carrera (EncountersService también
-- pre-chequea antes de insertar, pero solo este índice puede garantizarlo).
-- Prisma no soporta índices únicos parciales en el DSL del schema -- mismo
-- caso ya documentado en Workspace/Assessment/NutritionalPlan. No eliminar ni
-- recrear esta migración sin volver a añadir este índice a mano.
CREATE UNIQUE INDEX "ClinicalEncounter_one_in_progress_per_patient"
  ON "ClinicalEncounter" ("patientId")
  WHERE "status" = 'IN_PROGRESS';

-- CHECK constraints: consistencia entre status y los campos que solo tienen
-- sentido en un estado terminal específico. Nombres estables y explícitos
-- porque son parte del contrato de datos, no un detalle de implementación.
ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_completed_requires_completedAt"
  CHECK (status <> 'COMPLETED' OR "completedAt" IS NOT NULL);

ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_completedAt_only_when_completed"
  CHECK (status = 'COMPLETED' OR "completedAt" IS NULL);

ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_discarded_requires_discardedAt"
  CHECK (status <> 'DISCARDED' OR "discardedAt" IS NOT NULL);

ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_discardedAt_only_when_discarded"
  CHECK (status = 'DISCARDED' OR "discardedAt" IS NULL);

ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_discarded_requires_discardReason"
  CHECK (status <> 'DISCARDED' OR "discardReason" IS NOT NULL);

ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_discardReason_only_when_discarded"
  CHECK (status = 'DISCARDED' OR "discardReason" IS NULL);

ALTER TABLE "ClinicalEncounter"
  ADD CONSTRAINT "ClinicalEncounter_completionSnapshot_only_when_completed"
  CHECK (status = 'COMPLETED' OR "completionSnapshot" IS NULL);
