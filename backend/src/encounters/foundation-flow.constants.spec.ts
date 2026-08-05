import { ClinicalProfile, EncounterModule, ModuleApplicability } from '@prisma/client';
import { ENCOUNTER_MODULE_ORDER, FOUNDATION_FLOW_VERSION, getModuleStatesForProfile, initialStatusFor } from './foundation-flow.constants';

describe('foundation-flow.constants', () => {
  it('exposes a stable flowVersion constant', () => {
    expect(FOUNDATION_FLOW_VERSION).toBe('foundation-v1');
  });

  describe('getModuleStatesForProfile', () => {
    it('ADULT_GENERAL matches the foundation-v1 adult matrix', () => {
      const result = getModuleStatesForProfile(ClinicalProfile.ADULT_GENERAL);
      expect(result).toEqual([
        { module: EncounterModule.SUMMARY, applicability: ModuleApplicability.NOT_APPLICABLE },
        { module: EncounterModule.ANAMNESIS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.MEASUREMENTS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.REQUIREMENTS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.PLANNING, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.MEAL_PLAN, applicability: ModuleApplicability.OPTIONAL },
        { module: EncounterModule.INDICATIONS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.REPORT, applicability: ModuleApplicability.OPTIONAL },
        { module: EncounterModule.FOLLOW_UP, applicability: ModuleApplicability.OPTIONAL },
      ]);
    });

    it('ADULT_SPORT uses exactly the same matrix as ADULT_GENERAL in this MVP', () => {
      expect(getModuleStatesForProfile(ClinicalProfile.ADULT_SPORT)).toEqual(getModuleStatesForProfile(ClinicalProfile.ADULT_GENERAL));
    });

    it('PEDIATRIC does not require Planning or Meal Plan, but keeps the rest REQUIRED/OPTIONAL like adults', () => {
      const result = getModuleStatesForProfile(ClinicalProfile.PEDIATRIC);
      expect(result).toEqual([
        { module: EncounterModule.SUMMARY, applicability: ModuleApplicability.NOT_APPLICABLE },
        { module: EncounterModule.ANAMNESIS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.MEASUREMENTS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.REQUIREMENTS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.PLANNING, applicability: ModuleApplicability.NOT_APPLICABLE },
        { module: EncounterModule.MEAL_PLAN, applicability: ModuleApplicability.NOT_APPLICABLE },
        { module: EncounterModule.INDICATIONS, applicability: ModuleApplicability.REQUIRED },
        { module: EncounterModule.REPORT, applicability: ModuleApplicability.OPTIONAL },
        { module: EncounterModule.FOLLOW_UP, applicability: ModuleApplicability.OPTIONAL },
      ]);
    });

    it('always returns exactly the 9 EncounterModule values, in ENCOUNTER_MODULE_ORDER, for every profile', () => {
      for (const profile of Object.values(ClinicalProfile)) {
        const result = getModuleStatesForProfile(profile);
        expect(result).toHaveLength(9);
        expect(result.map((r) => r.module)).toEqual(ENCOUNTER_MODULE_ORDER);
        expect(new Set(result.map((r) => r.module)).size).toBe(9); // sin duplicados
      }
    });
  });

  describe('initialStatusFor', () => {
    it('NOT_APPLICABLE applicability starts with NOT_APPLICABLE status', () => {
      expect(initialStatusFor(ModuleApplicability.NOT_APPLICABLE)).toBe('NOT_APPLICABLE');
    });

    it('REQUIRED applicability starts with PENDING status', () => {
      expect(initialStatusFor(ModuleApplicability.REQUIRED)).toBe('PENDING');
    });

    it('OPTIONAL applicability starts with PENDING status', () => {
      expect(initialStatusFor(ModuleApplicability.OPTIONAL)).toBe('PENDING');
    });
  });
});
