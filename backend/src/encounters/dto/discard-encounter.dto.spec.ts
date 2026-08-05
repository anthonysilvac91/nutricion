import { ValidationPipe } from '@nestjs/common';
import { DiscardEncounterDto } from './discard-encounter.dto';

// Misma configuración que el ValidationPipe global (ver app.module.ts).
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

describe('DiscardEncounterDto (trim + whitespace-only)', () => {
  it('accepts a valid reason and keeps it unchanged', async () => {
    const result = await pipe.transform(
      { discardReason: 'Paciente no se presentó' },
      { type: 'body', metatype: DiscardEncounterDto } as any,
    );
    expect(result.discardReason).toBe('Paciente no se presentó');
  });

  it('trims leading/trailing whitespace before persisting', async () => {
    const result = await pipe.transform({ discardReason: '   No show   ' }, { type: 'body', metatype: DiscardEncounterDto } as any);
    expect(result.discardReason).toBe('No show');
  });

  it('rejects a discardReason made only of whitespace', async () => {
    await expect(pipe.transform({ discardReason: '     ' }, { type: 'body', metatype: DiscardEncounterDto } as any)).rejects.toThrow();
  });

  it('rejects an empty discardReason', async () => {
    await expect(pipe.transform({ discardReason: '' }, { type: 'body', metatype: DiscardEncounterDto } as any)).rejects.toThrow();
  });

  it('rejects a discardReason that is too short once trimmed', async () => {
    await expect(pipe.transform({ discardReason: '  hi  ' }, { type: 'body', metatype: DiscardEncounterDto } as any)).rejects.toThrow();
  });
});
