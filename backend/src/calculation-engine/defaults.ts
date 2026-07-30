/**
 * Non-editable PAL used to compute the Assessment-time baseline TDEE from
 * Patient.activityLevel. Also used as the initial (editable) PAL objective
 * when a new plan is created. Same values previously hardcoded in
 * frontend/components/patients/planning/EnergySection.tsx (PAL_OPTIONS),
 * now centralized here.
 */
export const ACTIVITY_LEVEL_TO_PAL: Record<string, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

/** UI catalog for the PAL picker -- backend-authored so the frontend never hardcodes these labels/values. */
export const PAL_OPTIONS = [
  { value: 'SEDENTARY', label: 'Sedentario', pal: ACTIVITY_LEVEL_TO_PAL.SEDENTARY },
  { value: 'LIGHT', label: 'Ligeramente activo', pal: ACTIVITY_LEVEL_TO_PAL.LIGHT },
  { value: 'MODERATE', label: 'Moderadamente activo', pal: ACTIVITY_LEVEL_TO_PAL.MODERATE },
  { value: 'ACTIVE', label: 'Muy activo', pal: ACTIVITY_LEVEL_TO_PAL.ACTIVE },
  { value: 'VERY_ACTIVE', label: 'Extra activo', pal: ACTIVITY_LEVEL_TO_PAL.VERY_ACTIVE },
];

/**
 * The only PAL values a plan may be recalculated/finalized with -- derived from PAL_OPTIONS so
 * there is a single source of truth. RecalculatePlanDto validates against this list (rejects any
 * other positive number, e.g. 1.3 or 2), and PlanCalculationService re-checks it as defense in
 * depth in case calculate() is ever called from a path that bypasses the DTO's ValidationPipe.
 */
export const PAL_ALLOWED_VALUES = PAL_OPTIONS.map((o) => o.pal);

/** UI catalog for the macro prescription method picker. */
export const MACRO_METHOD_OPTIONS = [
  { value: 'PERCENT', label: 'Porcentaje del GET' },
  { value: 'GRAMS_PER_KG', label: 'Gramos por kg de peso objetivo' },
];

/** Fixed BMR formula used for the non-editable baseline computed at Assessment time. */
export const DEFAULT_BMR_STRATEGY_ID = 'BMR_HARRIS_BENEDICT_V1';

export const DEFAULT_FIBER_SOURCE_ID = 'FIBER_IOM_V1';
export const DEFAULT_WATER_SOURCE_ID = 'WATER_IOM_V1';
