import { BadRequestException } from '@nestjs/common';
import {
    isValidClinicalDateString,
    parseClinicalDate,
    formatClinicalDate,
    parseClinicalOrLegacyIsoDate,
} from './clinical-date.util';

describe('clinical-date.util', () => {
    describe('parseClinicalDate', () => {
        it('conserva el 26 de julio sin importar la hora de ejecución', () => {
            const date = parseClinicalDate('2026-07-26');
            expect(date.getUTCFullYear()).toBe(2026);
            expect(date.getUTCMonth()).toBe(6); // 0-indexed
            expect(date.getUTCDate()).toBe(26);
            expect(date.getUTCHours()).toBe(12); // anclado a mediodía UTC
        });

        it('hace round-trip exacto con formatClinicalDate', () => {
            expect(formatClinicalDate(parseClinicalDate('2026-07-26'))).toBe('2026-07-26');
            expect(formatClinicalDate(parseClinicalDate('2024-02-29'))).toBe('2024-02-29');
            expect(formatClinicalDate(parseClinicalDate('2026-01-01'))).toBe('2026-01-01');
        });

        it.each([
            '2026-13-10', // mes inválido
            '2026-02-30', // día inválido para febrero
            '2023-02-29', // no es bisiesto
            '26-07-2026', // formato incorrecto
            'not-a-date',
            '',
            '2026-7-26', // sin ceros a la izquierda
            '2026/07/26', // separador incorrecto
        ])('rechaza "%s"', (input) => {
            expect(isValidClinicalDateString(input)).toBe(false);
            expect(() => parseClinicalDate(input)).toThrow(BadRequestException);
        });

        it('acepta un año bisiesto real', () => {
            expect(isValidClinicalDateString('2024-02-29')).toBe(true);
        });
    });

    describe('formatClinicalDate', () => {
        it('devuelve exactamente YYYY-MM-DD usando getters UTC', () => {
            expect(formatClinicalDate(new Date('2026-07-26T23:59:59.000Z'))).toBe('2026-07-26');
            expect(formatClinicalDate(new Date(Date.UTC(2026, 0, 5, 0, 0, 0)))).toBe('2026-01-05');
        });
    });

    describe('parseClinicalOrLegacyIsoDate (endpoint legado)', () => {
        it('acepta YYYY-MM-DD directamente', () => {
            expect(formatClinicalDate(parseClinicalOrLegacyIsoDate('2026-07-26'))).toBe('2026-07-26');
        });

        it('acepta ISO completo y lo normaliza al mismo día calendario UTC', () => {
            expect(formatClinicalDate(parseClinicalOrLegacyIsoDate('2026-07-26T23:59:00.000Z'))).toBe('2026-07-26');
            expect(formatClinicalDate(parseClinicalOrLegacyIsoDate('2026-07-26T00:00:00.000Z'))).toBe('2026-07-26');
        });

        it('rechaza texto que no es ninguna de las dos formas', () => {
            expect(() => parseClinicalOrLegacyIsoDate('not-a-date')).toThrow(BadRequestException);
            expect(() => parseClinicalOrLegacyIsoDate('')).toThrow(BadRequestException);
        });
    });
});
