import { PrismaClient, Sex, ActivityLevel, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();



async function main() {
  console.log('Running Seed...');

  // 1) Administrador principal (Admin)
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('⚠️  ADMIN_EMAIL o ADMIN_PASSWORD no configurados en .env. Omitiendo la creación del Admin principal.');
  } else {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdmin) {
      console.log(`ℹ️  Ya existe un administrador en el sistema (${existingAdmin.email}). Omitiendo creación.`);
    } else {
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
      const admin = await prisma.user.create({
        data: {
          email: adminEmail.toLowerCase().trim(),
          passwordHash: hashedAdminPassword,
          role: UserRole.ADMIN,
          subscriptionStatus: 'ACTIVE',
        },
      });
      console.log(`✅ Administrador principal creado exitosamente: ${admin.email}`);
    }
  }

  // 2) Usuario nutricionista
  const hashed = await bcrypt.hash('123456', 10);
  const user = await prisma.user.upsert({
    where: { email: 'nutri@demo.cl' },
    update: {
      passwordHash: hashed,
      role: UserRole.NUTRITIONIST,
    },
    create: {
      email: 'nutri@demo.cl',
      passwordHash: hashed,
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
