import { ClinicalProfile, EncounterModule, ModuleApplicability } from '@prisma/client';

/**
 * Versión de flujo congelada al crear una consulta (ClinicalEncounter.flowVersion).
 * El cliente nunca la envía -- el backend siempre selecciona esta constante. Un
 * cambio futuro en la matriz de módulos requiere una versión nueva (ej.
 * "mvp-v2"); las consultas ya creadas conservan la versión con la que
 * nacieron y jamás se recalculan retroactivamente.
 */
export const FOUNDATION_FLOW_VERSION = 'foundation-v1';

/**
 * Orden canónico de los 9 módulos de una consulta. Es el mismo orden para los
 * tres perfiles -- lo que cambia entre perfiles es la applicability de cada
 * módulo, nunca el orden en el que se presentan. Toda respuesta que incluya
 * `modules` debe ordenarse según este array, nunca según el orden de
 * inserción/lectura de PostgreSQL.
 */
export const ENCOUNTER_MODULE_ORDER: readonly EncounterModule[] = [
  EncounterModule.SUMMARY,
  EncounterModule.ANAMNESIS,
  EncounterModule.MEASUREMENTS,
  EncounterModule.REQUIREMENTS,
  EncounterModule.PLANNING,
  EncounterModule.MEAL_PLAN,
  EncounterModule.INDICATIONS,
  EncounterModule.REPORT,
  EncounterModule.FOLLOW_UP,
];

type ModuleMatrix = Record<EncounterModule, ModuleApplicability>;

const ADULT_MATRIX: ModuleMatrix = {
  [EncounterModule.SUMMARY]: ModuleApplicability.NOT_APPLICABLE,
  [EncounterModule.ANAMNESIS]: ModuleApplicability.REQUIRED,
  [EncounterModule.MEASUREMENTS]: ModuleApplicability.REQUIRED,
  [EncounterModule.REQUIREMENTS]: ModuleApplicability.REQUIRED,
  [EncounterModule.PLANNING]: ModuleApplicability.REQUIRED,
  [EncounterModule.MEAL_PLAN]: ModuleApplicability.OPTIONAL,
  [EncounterModule.INDICATIONS]: ModuleApplicability.REQUIRED,
  [EncounterModule.REPORT]: ModuleApplicability.OPTIONAL,
  [EncounterModule.FOLLOW_UP]: ModuleApplicability.OPTIONAL,
};

// PEDIATRIC difiere del adulto únicamente en PLANNING/MEAL_PLAN (NOT_APPLICABLE
// en el MVP pediátrico) -- se deriva del adulto en vez de repetir los otros 7
// valores, para que ambas matrices no puedan divergir accidentalmente en el resto.
const PEDIATRIC_MATRIX: ModuleMatrix = {
  ...ADULT_MATRIX,
  [EncounterModule.PLANNING]: ModuleApplicability.NOT_APPLICABLE,
  [EncounterModule.MEAL_PLAN]: ModuleApplicability.NOT_APPLICABLE,
};

/**
 * Única fuente de verdad de la matriz foundation-v1. No dupliques estos
 * valores en el controller, en otro servicio ni en los tests -- importa esta
 * constante (o `getModuleStatesForProfile`) en su lugar.
 */
export const FOUNDATION_FLOW_MATRIX: Record<ClinicalProfile, ModuleMatrix> = {
  [ClinicalProfile.ADULT_GENERAL]: ADULT_MATRIX,
  [ClinicalProfile.ADULT_SPORT]: ADULT_MATRIX,
  [ClinicalProfile.PEDIATRIC]: PEDIATRIC_MATRIX,
};

export interface ModuleStateSeed {
  module: EncounterModule;
  applicability: ModuleApplicability;
}

/** Los 9 EncounterModuleState a materializar al crear una consulta de este perfil, en orden canónico. */
export function getModuleStatesForProfile(profile: ClinicalProfile): ModuleStateSeed[] {
  const matrix = FOUNDATION_FLOW_MATRIX[profile];
  return ENCOUNTER_MODULE_ORDER.map((module) => ({ module, applicability: matrix[module] }));
}

/** PENDING para REQUIRED/OPTIONAL, NOT_APPLICABLE para NOT_APPLICABLE -- nunca otro valor al crear. */
export function initialStatusFor(applicability: ModuleApplicability): 'PENDING' | 'NOT_APPLICABLE' {
  return applicability === ModuleApplicability.NOT_APPLICABLE ? 'NOT_APPLICABLE' : 'PENDING';
}
