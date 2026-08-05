import { Prisma, PrismaClient, UserRole, WorkspaceRole, WorkspaceType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const PERSONAL_WORKSPACE_NAME = 'Espacio personal';
const DEFAULT_TIMEZONE = 'America/Santiago';

interface EligibleUser {
  id: string;
  email: string;
}

type Tx = Prisma.TransactionClient;

/**
 * Crea (o reutiliza) el Workspace PERSONAL de un usuario. La idempotencia real
 * vive en el índice único parcial "Workspace_one_personal_per_owner"
 * (ownerUserId) WHERE type = 'PERSONAL' -- el INSERT ... ON CONFLICT lo usa
 * como target explícito, así que dos ejecuciones concurrentes de este script
 * nunca pueden crear dos Workspace PERSONAL para el mismo owner (a diferencia
 * de un findFirst() + create() sin protección de BD).
 */
async function ensurePersonalWorkspace(tx: Tx, userId: string): Promise<string> {
  const inserted = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "Workspace" ("id", "ownerUserId", "type", "name", "timezone", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, 'PERSONAL', ${PERSONAL_WORKSPACE_NAME}, ${DEFAULT_TIMEZONE}, now(), now())
    ON CONFLICT ("ownerUserId") WHERE "type" = 'PERSONAL' DO NOTHING
    RETURNING "id"
  `;
  if (inserted.length > 0) {
    return inserted[0].id;
  }
  const existing = await tx.workspace.findFirstOrThrow({
    where: { ownerUserId: userId, type: WorkspaceType.PERSONAL },
    select: { id: true },
  });
  return existing.id;
}

/**
 * Idempotente vía @@unique([workspaceId, userId]) -- upsert nunca duplica.
 * `update` repara explícitamente el rol a OWNER: el dueño de un Workspace
 * PERSONAL debe ser siempre OWNER de su propia membresía, incluso si una
 * ejecución anómala anterior la dejó en PROFESSIONAL.
 */
async function ensureOwnerMembership(tx: Tx, workspaceId: string, userId: string): Promise<void> {
  await tx.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role: WorkspaceRole.OWNER },
    create: { workspaceId, userId, role: WorkspaceRole.OWNER },
  });
}

/**
 * Solo actualiza pacientes con workspaceId aún nulo -- nunca reasigna un
 * paciente ya asociado a otro Workspace (requisito explícito del backfill).
 */
async function backfillPatientsWorkspace(tx: Tx, workspaceId: string, userId: string): Promise<number> {
  return tx.$executeRaw`
    UPDATE "Patient" SET "workspaceId" = ${workspaceId}
    WHERE "userId" = ${userId} AND "workspaceId" IS NULL
  `;
}

/**
 * Elegibles para Workspace PERSONAL (decisión de negocio cerrada):
 * - todo User.role = NUTRITIONIST;
 * - todo User.role = ADMIN que tenga al menos un Patient vía Patient.userId.
 * Un ADMIN de plataforma sin pacientes propios no recibe Workspace.
 */
async function findEligibleUsers(): Promise<EligibleUser[]> {
  const nutritionists = await prisma.user.findMany({
    where: { role: UserRole.NUTRITIONIST },
    select: { id: true, email: true },
  });

  const adminsWithPatients = await prisma.user.findMany({
    where: { role: UserRole.ADMIN, patients: { some: {} } },
    select: { id: true, email: true },
  });

  return [...nutritionists, ...adminsWithPatients];
}

async function main() {
  const users = await findEligibleUsers();
  console.log(`Usuarios elegibles para Workspace PERSONAL: ${users.length}`);

  let patientsUpdated = 0;

  for (const user of users) {
    // Una transacción por usuario -- si el proceso se interrumpe a mitad de
    // camino, los usuarios ya procesados quedan consistentes y una segunda
    // ejecución retoma exactamente donde quedó (idempotente), sin mantener una
    // única transacción gigante que bloquee la tabla Patient durante todo el proceso.
    await prisma.$transaction(async (tx) => {
      const workspaceId = await ensurePersonalWorkspace(tx, user.id);
      await ensureOwnerMembership(tx, workspaceId, user.id);
      patientsUpdated += await backfillPatientsWorkspace(tx, workspaceId, user.id);
    });
  }

  console.log(`Backfill completado. Pacientes actualizados (workspaceId antes nulo) en esta ejecución: ${patientsUpdated}.`);
  console.log('Ejecuta "npx ts-node prisma/verify-workspace-backfill.ts" para confirmar el estado antes de aplicar la Migración B.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el backfill de Workspaces:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
