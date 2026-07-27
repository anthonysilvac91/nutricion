import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationOptions } from 'class-validator';

const CLINICAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A clinical date is a calendar day (the day an evaluation happened), not an instant --
 * unlike createdAt/updatedAt/completedAt, which are real timestamps. Validates the string
 * shape AND that the date actually exists on the calendar (rejects 2026-02-30 by round-tripping
 * through Date.UTC and checking nothing rolled over).
 */
export function isValidClinicalDateString(input: unknown): input is string {
  if (typeof input !== 'string' || !CLINICAL_DATE_PATTERN.test(input)) return false;
  const [year, month, day] = input.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function IsClinicalDateString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isClinicalDateString',
      target: object.constructor,
      propertyName,
      options: { message: '$property must be a valid calendar date in YYYY-MM-DD format', ...validationOptions },
      validator: {
        validate(value: unknown) {
          return isValidClinicalDateString(value);
        },
      },
    });
  };
}

/**
 * Parses a YYYY-MM-DD clinical date into a Date anchored at 12:00 UTC. Noon (not midnight) is
 * deliberate: noon +/-14h never crosses into a different calendar day in any real-world time
 * zone, so the stored instant survives round-tripping through Assessment.date's
 * `timestamp without time zone` column (Prisma always reads/writes that column as UTC) even if
 * something downstream ever reads it with local getters by mistake.
 */
export function parseClinicalDate(input: string): Date {
  if (!isValidClinicalDateString(input)) {
    throw new BadRequestException(`Invalid clinical date: "${input}". Expected format YYYY-MM-DD.`);
  }
  const [year, month, day] = input.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/** Formats a Date back into YYYY-MM-DD using UTC getters only -- never locale/server timezone. */
export function formatClinicalDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compatibility shim for the legacy POST /patients/:id/assessments endpoint, which historically
 * accepted a full ISO timestamp. Accepts either YYYY-MM-DD or a full ISO datetime string and
 * normalizes both to the same calendar day anchored at noon UTC. The full-ISO form is deprecated
 * -- new callers should send YYYY-MM-DD.
 */
export function parseClinicalOrLegacyIsoDate(input: string): Date {
  if (isValidClinicalDateString(input)) return parseClinicalDate(input);
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid date: "${input}". Expected format YYYY-MM-DD.`);
  }
  return parseClinicalDate(formatClinicalDate(parsed));
}
