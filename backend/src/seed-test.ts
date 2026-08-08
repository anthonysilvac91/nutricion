import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Patient.workspaceId es NOT NULL desde la Migración B -- este script crea el
// usuario directamente (no pasa por AuthService.register()), así que
// necesita resolver un Workspace explícitamente. Mismo patrón idempotente
// que prisma/backfill-workspaces.ts.
async function ensurePersonalWorkspaceId(userId: string): Promise<string> {
  const inserted = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "Workspace" ("id", "ownerUserId", "type", "name", "timezone", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, 'PERSONAL', 'Espacio personal', 'America/Santiago', now(), now())
    ON CONFLICT ("ownerUserId") WHERE "type" = 'PERSONAL' DO NOTHING
    RETURNING "id"
  `;
  const workspaceId =
    inserted.length > 0
      ? inserted[0].id
      : (await prisma.workspace.findFirstOrThrow({ where: { ownerUserId: userId, type: 'PERSONAL' }, select: { id: true } })).id;

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role: 'OWNER' },
    create: { workspaceId, userId, role: 'OWNER' },
  });

  return workspaceId;
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { passwordHash },
    create: {
      email: 'test@example.com',
      passwordHash,
      role: 'NUTRITIONIST',
    },
  });
  console.log('User created:', user.id);

  const workspaceId = await ensurePersonalWorkspaceId(user.id);
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      workspaceId,
      firstName: 'Test',
      lastName: 'Patient',
      sex: 'MALE',
      birthDate: new Date('1990-01-01'),
      activityLevel: 'SEDENTARY',
    }
  });
  console.log('Patient created:', patient.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
