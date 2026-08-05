import { ValidationPipe } from '@nestjs/common';
import { ClinicalProfile, EncounterType } from '@prisma/client';
import { CreateEncounterDto } from './create-encounter.dto';

// Reproduce exactamente la configuración del ValidationPipe global (ver
// app.module.ts: whitelist + forbidNonWhitelisted + transform) para probar,
// a nivel de DTO, que el cliente no puede inyectar campos que el backend
// debe resolver por su cuenta.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const VALID_BODY = {
  profile: ClinicalProfile.ADULT_GENERAL,
  type: EncounterType.FIRST_VISIT,
  clinicalDate: '2026-08-04',
};

describe('CreateEncounterDto (whitelist)', () => {
  it('accepts a valid body with only the documented fields', async () => {
    await expect(
      pipe.transform({ ...VALID_BODY, consultationReason: 'Control', notes: 'Texto' }, { type: 'body', metatype: CreateEncounterDto } as any),
    ).resolves.toBeInstanceOf(CreateEncounterDto);
  });

  it('rejects a client-supplied flowVersion', async () => {
    await expect(
      pipe.transform({ ...VALID_BODY, flowVersion: 'mvp-v2' }, { type: 'body', metatype: CreateEncounterDto } as any),
    ).rejects.toThrow();
  });

  it('rejects a client-supplied workspaceId', async () => {
    await expect(
      pipe.transform({ ...VALID_BODY, workspaceId: 'ws-1' }, { type: 'body', metatype: CreateEncounterDto } as any),
    ).rejects.toThrow();
  });

  it('rejects a client-supplied responsibleProfessionalId', async () => {
    await expect(
      pipe.transform({ ...VALID_BODY, responsibleProfessionalId: 'user-1' }, { type: 'body', metatype: CreateEncounterDto } as any),
    ).rejects.toThrow();
  });

  it('rejects a client-supplied status', async () => {
    await expect(
      pipe.transform({ ...VALID_BODY, status: 'COMPLETED' }, { type: 'body', metatype: CreateEncounterDto } as any),
    ).rejects.toThrow();
  });

  it('rejects a client-supplied modules array', async () => {
    await expect(
      pipe.transform({ ...VALID_BODY, modules: [] }, { type: 'body', metatype: CreateEncounterDto } as any),
    ).rejects.toThrow();
  });
});
