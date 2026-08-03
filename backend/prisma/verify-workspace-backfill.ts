import { PrismaClient, UserRole, WorkspaceRole, WorkspaceType } from '@prisma/client';

const prisma = new PrismaClient();

interface OwnerCount {
  ownerUserId: string;
  count: bigint;
}

interface MembershipCount {
  workspaceId: string;
  userId: string;
  count: bigint;
}

/**
 * Verificación de solo lectura del backfill de Workspaces. No modifica datos --
 * si encuentra pacientes sin workspaceId, la reparación es volver a ejecutar
 * "backfill-workspaces.ts" (idempotente), no este script.
 *
 * Sale con código distinto de cero si:
 * - queda algún Patient sin workspaceId (bloquea la Migración B);
 * - algún owner tiene más de un Workspace PERSONAL (no debería ser posible por
 *   el índice único parcial, pero se verifica igual);
 * - algún NUTRITIONIST o ADMIN-con-pacientes no tiene Workspace PERSONAL;
 * - hay memberships duplicados (no debería ser posible por @@unique).
 */
async function main() {
  const [nutritionistCount, adminWithPatients, adminWithoutPatients] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.NUTRITIONIST } }),
    prisma.user.count({ where: { role: UserRole.ADMIN, patients: { some: {} } } }),
    prisma.user.count({ where: { role: UserRole.ADMIN, patients: { none: {} } } }),
  ]);

  // Pacientes con/sin workspaceId se consultan con SQL crudo (no con el filtro
  // tipado de Prisma) a propósito: este script debe seguir compilando y
  // funcionando tanto ANTES de la Migración B (columna nullable, es su caso de
  // uso principal) como después (columna NOT NULL, chequeo de salud) -- una
  // vez aplicada la Migración B, el cliente Prisma generado ya no permite
  // filtrar `workspaceId: null` en el tipo `PatientWhereInput`.
  const [personalWorkspaces, ownerMemberships, totalPatients] = await Promise.all([
    prisma.workspace.count({ where: { type: WorkspaceType.PERSONAL } }),
    prisma.workspaceMember.count({ where: { role: WorkspaceRole.OWNER } }),
    prisma.patient.count(),
  ]);
  const [{ count: patientsWithoutWorkspaceRaw }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Patient" WHERE "workspaceId" IS NULL
  `;
  const patientsWithoutWorkspace = Number(patientsWithoutWorkspaceRaw);
  const patientsWithWorkspace = totalPatients - patientsWithoutWorkspace;

  const nutritionistsWithoutPersonalWorkspace = await prisma.user.count({
    where: { role: UserRole.NUTRITIONIST, ownedWorkspaces: { none: { type: WorkspaceType.PERSONAL } } },
  });

  const adminsWithPatientsWithoutPersonalWorkspace = await prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      patients: { some: {} },
      ownedWorkspaces: { none: { type: WorkspaceType.PERSONAL } },
    },
  });

  // No debería ocurrir nunca gracias al índice único parcial
  // "Workspace_one_personal_per_owner" -- se verifica igual porque ese índice
  // solo existe si la Migración A ya se aplicó en este entorno.
  const duplicatePersonalOwnersRaw = await prisma.$queryRaw<OwnerCount[]>`
    SELECT "ownerUserId", COUNT(*) as count
    FROM "Workspace"
    WHERE "type" = 'PERSONAL'
    GROUP BY "ownerUserId"
    HAVING COUNT(*) > 1
  `;
  const duplicatePersonalOwners = duplicatePersonalOwnersRaw.map((r) => ({ ownerUserId: r.ownerUserId, count: Number(r.count) }));

  // No debería ocurrir nunca gracias a @@unique([workspaceId, userId]) -- chequeo defensivo.
  const duplicateMembershipsRaw = await prisma.$queryRaw<MembershipCount[]>`
    SELECT "workspaceId", "userId", COUNT(*) as count
    FROM "WorkspaceMember"
    GROUP BY "workspaceId", "userId"
    HAVING COUNT(*) > 1
  `;
  const duplicateMemberships = duplicateMembershipsRaw.map((r) => ({
    workspaceId: r.workspaceId,
    userId: r.userId,
    count: Number(r.count),
  }));

  console.log('--- Resumen de verificación del backfill de Workspaces ---');
  console.log(`Usuarios NUTRITIONIST:                          ${nutritionistCount}`);
  console.log(`Usuarios ADMIN con pacientes:                    ${adminWithPatients}`);
  console.log(`Usuarios ADMIN sin pacientes:                    ${adminWithoutPatients}`);
  console.log(`Workspaces PERSONAL existentes:                  ${personalWorkspaces}`);
  console.log(`WorkspaceMembers con rol OWNER:                  ${ownerMemberships}`);
  console.log(`Pacientes totales:                               ${totalPatients}`);
  console.log(`Pacientes con workspaceId:                       ${patientsWithWorkspace}`);
  console.log(`Pacientes sin workspaceId:                       ${patientsWithoutWorkspace}`);
  console.log(`NUTRITIONIST sin Workspace PERSONAL:             ${nutritionistsWithoutPersonalWorkspace}`);
  console.log(`ADMIN con pacientes sin Workspace PERSONAL:      ${adminsWithPatientsWithoutPersonalWorkspace}`);
  console.log(`Propietarios con más de un Workspace PERSONAL:   ${duplicatePersonalOwners.length}`);
  console.log(`Memberships duplicados:                          ${duplicateMemberships.length}`);

  const problems: string[] = [];

  if (patientsWithoutWorkspace > 0) {
    problems.push(`${patientsWithoutWorkspace} paciente(s) sin workspaceId. No apliques la Migración B (NOT NULL) todavía.`);
  }
  if (duplicatePersonalOwners.length > 0) {
    problems.push(`${duplicatePersonalOwners.length} propietario(s) con más de un Workspace PERSONAL: ${JSON.stringify(duplicatePersonalOwners)}`);
  }
  if (nutritionistsWithoutPersonalWorkspace > 0) {
    problems.push(`${nutritionistsWithoutPersonalWorkspace} NUTRITIONIST sin Workspace PERSONAL. Ejecuta backfill-workspaces.ts nuevamente.`);
  }
  if (adminsWithPatientsWithoutPersonalWorkspace > 0) {
    problems.push(`${adminsWithPatientsWithoutPersonalWorkspace} ADMIN con pacientes sin Workspace PERSONAL. Ejecuta backfill-workspaces.ts nuevamente.`);
  }
  if (duplicateMemberships.length > 0) {
    problems.push(`${duplicateMemberships.length} membership(s) duplicado(s): ${JSON.stringify(duplicateMemberships)}`);
  }

  if (problems.length > 0) {
    console.error('\n❌ Verificación FALLIDA:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log('\n✅ Backfill verificado. Es seguro aplicar la Migración B (Patient.workspaceId NOT NULL).');
  process.exit(0);
}

main()
  .catch((e) => {
    console.error('❌ Error al verificar el backfill de Workspaces:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
