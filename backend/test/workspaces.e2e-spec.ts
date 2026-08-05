import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// Cubre el corte 1 de la fase Consulta Clínica: todo NUTRITIONIST nuevo debe
// nacer con exactamente un Workspace PERSONAL y una membership OWNER creados
// atómicamente en el registro (AuthService.register()), y crear pacientes
// después no debe generar un segundo Workspace ni tocar la membership --
// PatientsService.resolvePersonalWorkspaceId() debe encontrar y reutilizar el
// mismo Workspace (fallback idempotente, no ruta principal en este caso).
describe('Workspace foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates exactly one PERSONAL workspace with an OWNER membership on registration, and reuses it for every patient created afterwards', async () => {
    // 1. Registrar nutricionista
    const resAuth = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `e2e-workspace-${Date.now()}@test.com`, password: 'password123' })
      .expect(201);

    const token: string = resAuth.body.access_token;
    const userId: string = resAuth.body.user.id;
    expect(resAuth.body.user.role).toBe('NUTRITIONIST');

    // 2. Comprobar el Workspace PERSONAL antes de crear ningún paciente --
    // debe existir ya por el registro, no depender de la creación de un paciente.
    const workspacesAfterRegister = await prisma.workspace.findMany({
      where: { ownerUserId: userId, type: 'PERSONAL' },
    });
    expect(workspacesAfterRegister).toHaveLength(1);
    const workspaceId = workspacesAfterRegister[0].id;
    expect(workspacesAfterRegister[0].timezone).toBe('America/Santiago');

    // 3. Comprobar la membership OWNER
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('OWNER');

    // 4. Crear dos pacientes
    const createPatient = (firstName: string) =>
      request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName,
          lastName: 'Workspace',
          sex: 'MALE',
          birthDate: '1990-01-01T00:00:00.000Z',
          activityLevel: 'MODERATE',
        });

    const [resPatientA, resPatientB] = await Promise.all([createPatient('Patient-A'), createPatient('Patient-B')]);
    expect(resPatientA.status).toBe(201);
    expect(resPatientB.status).toBe(201);

    // 5. Ambos usan el mismo workspaceId
    const patientA = await prisma.patient.findUniqueOrThrow({ where: { id: resPatientA.body.id } });
    const patientB = await prisma.patient.findUniqueOrThrow({ where: { id: resPatientB.body.id } });
    expect(patientA.workspaceId).toBe(workspaceId);
    expect(patientB.workspaceId).toBe(workspaceId);

    // 6. Sigue existiendo un solo Workspace PERSONAL para este usuario
    const workspacesAfterPatients = await prisma.workspace.findMany({
      where: { ownerUserId: userId, type: 'PERSONAL' },
    });
    expect(workspacesAfterPatients).toHaveLength(1);
    expect(workspacesAfterPatients[0].id).toBe(workspaceId);

    // La membership sigue siendo exactamente una, con rol OWNER.
    const membershipsAfterPatients = await prisma.workspaceMember.findMany({ where: { workspaceId, userId } });
    expect(membershipsAfterPatients).toHaveLength(1);
    expect(membershipsAfterPatients[0].role).toBe('OWNER');
  });
});
