import { PrismaClient, Sex, ActivityLevel, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Usuario nutricionista
  const user = await prisma.user.upsert({
    where: { email: 'nutri@demo.cl' },
    update: {},
    create: {
      email: 'nutri@demo.cl',
      passwordHash: 'demo_hash', // luego lo reemplazamos por bcrypt en Auth
      role: UserRole.NUTRITIONIST,
    },
  });

  // 2) Paciente
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      firstName: 'Juan',
      lastName: 'Pérez',
      sex: Sex.MALE,
      birthDate: new Date('1995-06-15'),
      activityLevel: ActivityLevel.MODERATE,
    },
  });

  // 3) Mediciones (2)
  await prisma.measurement.createMany({
    data: [
      {
        patientId: patient.id,
        weightKg: 78.4,
        heightCm: 176,
        waistCm: 88,
        measuredAt: new Date('2026-01-10T10:00:00Z'),
      },
      {
        patientId: patient.id,
        weightKg: 77.2,
        heightCm: 176,
        waistCm: 87,
        measuredAt: new Date('2026-01-24T10:00:00Z'),
      },
    ],
  });

  console.log('✅ Seed OK:', { userEmail: user.email, patientId: patient.id });
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
