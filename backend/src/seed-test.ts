import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
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
