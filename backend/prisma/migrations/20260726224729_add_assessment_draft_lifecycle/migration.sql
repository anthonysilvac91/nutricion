-- Limpieza de datos de desarrollo: pueden existir varios Assessment DRAFT
-- sueltos por paciente de pruebas manuales previas al índice único. Se
-- conserva solo el más reciente por paciente; el resto (y sus
-- MeasurementRecord/CalculatedResult asociados, por onDelete: Cascade) se
-- descartan porque un DRAFT es por definición un dato no finalizado.
DELETE FROM "Assessment" a
WHERE a."status" = 'DRAFT'
AND a."id" NOT IN (
  SELECT DISTINCT ON ("patientId") "id" FROM "Assessment"
  WHERE "status" = 'DRAFT'
  ORDER BY "patientId", "createdAt" DESC
);

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- Un solo Assessment DRAFT activo por paciente, igual que ya existe para
-- NutritionalPlan (ver 20260726172128_add_assessment_link_and_snapshot_to_plan).
-- Prisma no soporta índices únicos parciales en el DSL del schema -- no
-- eliminar ni recrear esta migración sin volver a añadir este índice a mano.
CREATE UNIQUE INDEX "Assessment_one_draft_per_patient"
  ON "Assessment" ("patientId")
  WHERE "status" = 'DRAFT';
