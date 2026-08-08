/*
  Warnings:

  - Made the column `workspaceId` on table `Patient` required. This step will fail if there are existing NULL values in that column.
  - The FK "Patient_workspaceId_fkey" changes its ON DELETE action from SET NULL to RESTRICT, now that workspaceId is mandatory -- SET NULL is not a coherent action for a NOT NULL column.

*/

-- Guard explícito: aborta la migración completa (transacción revertida) si
-- queda algún Patient sin workspaceId, en vez de dejar que el ALTER COLUMN
-- falle con el mensaje genérico de Postgres. El backfill de producción
-- (prisma/backfill-workspaces.ts) ya se ejecutó y verificó
-- (prisma/verify-workspace-backfill.ts) antes de crear esta migración -- no
-- se hace ningún UPDATE ni se asigna ningún Workspace aquí; si este guard
-- dispara, hay que volver a correr el backfill/verify, no "corregir" el dato
-- desde la migración.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Patient"
    WHERE "workspaceId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot require Patient.workspaceId: patients with NULL workspaceId exist';
  END IF;
END $$;

-- DropForeignKey
-- FK original del corte 1 (20260803200845_add_workspace_foundation): ON DELETE SET NULL,
-- incoherente ahora que la columna es obligatoria.
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_workspaceId_fkey";

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AddForeignKey
-- Reemplaza SET NULL por RESTRICT: un Workspace con al menos un Patient no puede
-- eliminarse (nunca deja huérfano a un Patient ni lo borra en cascada).
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
