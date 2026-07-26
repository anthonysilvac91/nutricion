import { API_BASE_URL } from "@/lib/api";
export type MeasurementGroup = 'BASIC' | 'COMPOSITION' | 'SKINFOLD' | 'GIRTH';

export const GROUP_LABELS: Record<MeasurementGroup, string> = {
    BASIC: 'Básicas',
    COMPOSITION: 'C. Corporal',
    SKINFOLD: 'Pliegues',
    GIRTH: 'Perímetros',
};

export interface MeasurementDefinition {
    id: string;
    group: MeasurementGroup;
    name: string;
    unit: string;
    icon?: string;
}

// ---- DTOs devueltos por el backend (measurement-summary / history) ----

export interface MeasurementValueDto {
    assessmentId: string;
    recordId: string;
    value: number | string;
    date: string;
}

export interface MeasurementChangeDto {
    difference: number;
    trend: "UP" | "DOWN" | "FLAT";
    fromDate: string;
    toDate: string;
}

export interface MeasurementCardDto {
    definitionId: string;
    group: MeasurementGroup;
    name: string;
    unit: string;
    draft: MeasurementValueDto | null;
    latestCompleted: MeasurementValueDto | null;
    previousCompleted: MeasurementValueDto | null;
    change: MeasurementChangeDto | null;
}

export interface ActiveDraftDto {
    id: string;
    date: string;
    status: "DRAFT";
    measurementCount: number;
    updatedAt: string;
}

export interface MeasurementSummaryDto {
    patientId: string;
    activeDraft: ActiveDraftDto | null;
    definitions: MeasurementDefinition[];
    cards: MeasurementCardDto[];
}

export interface HistoryEntryDto {
    recordId: string;
    assessmentId: string;
    value: number | string;
    date: string;
}

export interface HistoryDto {
    definition: { id: string; name: string; unit: string };
    data: HistoryEntryDto[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AssessmentDto {
    id: string;
    status: "DRAFT" | "COMPLETED" | "ARCHIVED";
    date: string;
    measurements: { id: string; definitionId: string; numericValue: number | null; stringValue: string | null }[];
    results: any[];
}

function authHeaders() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function handle(res: Response) {
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Error desconocido" }));
        throw new Error(error.message || "Error en la petición");
    }
    return res.json();
}

// ---- Definiciones y mediciones mock (solo para el modo demo, nunca se mezclan con la vista real) ----

export const mockDefinitions: MeasurementDefinition[] = [
    // BASIC (Básicas)
    { id: 'm_weight', group: 'BASIC', name: 'Peso', unit: 'kg' },
    { id: 'm_height', group: 'BASIC', name: 'Estatura', unit: 'cm' },
    { id: 'm_hip', group: 'BASIC', name: 'Perímetro de la cadera', unit: 'cm' },
    { id: 'm_waist', group: 'BASIC', name: 'Perímetro de la cintura', unit: 'cm' },

    // COMPOSITION (Composición corporal)
    { id: 'm_visceral_fat', group: 'COMPOSITION', name: 'Grasa visceral', unit: 'lvl' },
    { id: 'm_fat_mass', group: 'COMPOSITION', name: 'Masa grasa', unit: 'kg' },
    { id: 'm_fat_free_mass', group: 'COMPOSITION', name: 'Masa libre de grasa', unit: 'kg' },
    { id: 'm_lean_mass', group: 'COMPOSITION', name: 'Masa magra', unit: 'kg' },
    { id: 'm_muscle_mass', group: 'COMPOSITION', name: 'Masa muscular', unit: 'kg' },
    { id: 'm_bone_mass', group: 'COMPOSITION', name: 'Masa ósea', unit: 'kg' },
    { id: 'm_fat_percent', group: 'COMPOSITION', name: 'Porcentaje de grasa', unit: '%' },

    // SKINFOLD (Pliegues cutáneos)
    { id: 'sf_abdominal', group: 'SKINFOLD', name: 'Pliegue cutáneo abdominal', unit: 'mm' },
    { id: 'sf_mid_axillary', group: 'SKINFOLD', name: 'Pliegue cutáneo axilar medio', unit: 'mm' },
    { id: 'sf_bicep', group: 'SKINFOLD', name: 'Pliegue cutáneo bicipital', unit: 'mm' },
    { id: 'sf_calf', group: 'SKINFOLD', name: 'Pliegue cutáneo pantorrilla', unit: 'mm' },
    { id: 'sf_iliocristale', group: 'SKINFOLD', name: 'Pliegue cutáneo iliocristal', unit: 'mm' },
    { id: 'sf_pectoral', group: 'SKINFOLD', name: 'Pliegue cutáneo pectoral', unit: 'mm' },
    { id: 'sf_subscapular', group: 'SKINFOLD', name: 'Pliegue cutáneo subescapular', unit: 'mm' },
    { id: 'sf_supraspinale', group: 'SKINFOLD', name: 'Pliegue cutáneo supraespinal', unit: 'mm' },
    { id: 'sf_suprailiac', group: 'SKINFOLD', name: 'Pliegue cutáneo suprailíaco', unit: 'mm' },
    { id: 'sf_tricep', group: 'SKINFOLD', name: 'Pliegue cutáneo tricipital', unit: 'mm' },
    { id: 'sf_front_thigh', group: 'SKINFOLD', name: 'Pliegue cutáneo muslo anterior', unit: 'mm' },
    { id: 'sf_sum_5', group: 'SKINFOLD', name: 'Suma de 5 pliegues', unit: 'mm' },
    { id: 'sf_sum_8', group: 'SKINFOLD', name: 'Suma de 8 pliegues', unit: 'mm' },

    // GIRTH (Mediciones corporales / Perímetros / Diámetros)
    { id: 'm_dia_femur', group: 'GIRTH', name: 'Diámetro biepicondilar del fémur', unit: 'cm' },
    { id: 'm_dia_wrist', group: 'GIRTH', name: 'Diámetro biestiloideo de la muñeca', unit: 'cm' },
    { id: 'm_dia_elbow', group: 'GIRTH', name: 'Diámetro del codo', unit: 'cm' },
    { id: 'm_dia_ankle', group: 'GIRTH', name: 'Diámetro del tobillo', unit: 'cm' },
    { id: 'm_sub_fat_abd', group: 'GIRTH', name: 'Grasa subcutánea en el abdomen', unit: 'mm' },
    { id: 'm_cir_abdominal', group: 'GIRTH', name: 'Perímetro abdominal', unit: 'cm' },
    { id: 'm_cir_head', group: 'GIRTH', name: 'Perímetro cefálico', unit: 'cm' },
    { id: 'm_cir_shoulder', group: 'GIRTH', name: 'Perímetro de hombros', unit: 'cm' },
    { id: 'm_cir_wrist', group: 'GIRTH', name: 'Perímetro de la muñeca', unit: 'cm' },
    { id: 'm_cir_upper_thigh', group: 'GIRTH', name: 'Perímetro parte superior del muslo', unit: 'cm' },
    { id: 'm_cir_forearm', group: 'GIRTH', name: 'Perímetro del antebrazo', unit: 'cm' },
    { id: 'm_cir_arm', group: 'GIRTH', name: 'Perímetro del brazo', unit: 'cm' },
    { id: 'm_cir_arm_flexed', group: 'GIRTH', name: 'Perímetro del brazo en flexión', unit: 'cm' },
    { id: 'm_cir_arm_relaxed', group: 'GIRTH', name: 'Perímetro del brazo relajado', unit: 'cm' },
    { id: 'm_cir_neck', group: 'GIRTH', name: 'Perímetro del cuello', unit: 'cm' },
    { id: 'm_cir_ankle', group: 'GIRTH', name: 'Perímetro del tobillo', unit: 'cm' },
    { id: 'm_cir_calf', group: 'GIRTH', name: 'Perímetro gemelar', unit: 'cm' },
    { id: 'm_cir_mid_thigh', group: 'GIRTH', name: 'Perímetro medio del muslo', unit: 'cm' },
    { id: 'm_cir_chest', group: 'GIRTH', name: 'Perímetro pectoral', unit: 'cm' },
    { id: 'm_waist_hip_ratio', group: 'GIRTH', name: 'Índice cintura-cadera', unit: 'ratio' },
];

export const MOCK_BASE_VALUES: Record<string, number[]> = {
    'm_weight': [80.2, 77.5, 74.8, 72.5],
    'm_height': [165, 165, 165, 165],
    'm_hip': [102, 100, 99, 97],
    'm_waist': [88, 86, 84, 82],
    'm_visceral_fat': [11, 10, 9, 8],
    'm_fat_mass': [24.1, 22.8, 21.4, 20.3],
    'm_fat_free_mass': [56.1, 54.7, 53.4, 52.2],
    'm_lean_mass': [53.2, 52.0, 50.8, 49.8],
    'm_muscle_mass': [39.1, 38.2, 37.3, 36.4],
    'm_bone_mass': [2.9, 2.8, 2.8, 2.7],
    'm_fat_percent': [30.1, 29.4, 28.7, 28.1],
};

export function mockDates() {
    return [3, 2, 1, 0].map(monthsAgo => {
        const d = new Date();
        d.setMonth(d.getMonth() - monthsAgo);
        return d.toISOString().split('T')[0];
    });
}

/** Fabrica un MeasurementSummaryDto sintético para el modo mock -- nunca se usa en la vista real. */
function buildMockSummary(): MeasurementSummaryDto {
    const dates = mockDates();
    const cards: MeasurementCardDto[] = mockDefinitions.map(def => {
        const values = MOCK_BASE_VALUES[def.id];
        if (!values) {
            return { definitionId: def.id, group: def.group, name: def.name, unit: def.unit, draft: null, latestCompleted: null, previousCompleted: null, change: null };
        }
        const latest = { assessmentId: `mock_a_${def.id}_3`, recordId: `mock_${def.id}_3`, value: values[3], date: dates[3] };
        const previous = { assessmentId: `mock_a_${def.id}_2`, recordId: `mock_${def.id}_2`, value: values[2], date: dates[2] };
        const difference = parseFloat((latest.value - previous.value).toFixed(2));
        return {
            definitionId: def.id,
            group: def.group,
            name: def.name,
            unit: def.unit,
            draft: null,
            latestCompleted: latest,
            previousCompleted: previous,
            change: { difference, trend: difference > 0 ? "UP" : difference < 0 ? "DOWN" : "FLAT", fromDate: previous.date, toDate: latest.date },
        };
    });

    return { patientId: "mock-patient", activeDraft: null, definitions: mockDefinitions, cards };
}

export const measurementsService = {
    getSummary: async (patientId: string): Promise<MeasurementSummaryDto> => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}/measurement-summary`, { headers: authHeaders() });
        return handle(res);
    },

    createOrGetDraft: async (patientId: string, date?: string): Promise<AssessmentDto> => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}/assessments/draft`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(date ? { date } : {}),
        });
        return handle(res);
    },

    upsertMeasurements: async (
        patientId: string,
        assessmentId: string,
        measurements: { definitionId: string; numericValue?: number; stringValue?: string }[],
    ): Promise<AssessmentDto> => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}/assessments/${assessmentId}/measurements`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ measurements }),
        });
        return handle(res);
    },

    removeMeasurement: async (patientId: string, assessmentId: string, definitionId: string): Promise<AssessmentDto> => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}/assessments/${assessmentId}/measurements/${definitionId}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        return handle(res);
    },

    completeAssessment: async (patientId: string, assessmentId: string): Promise<AssessmentDto> => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}/assessments/${assessmentId}/complete`, {
            method: "POST",
            headers: authHeaders(),
        });
        return handle(res);
    },

    getHistory: async (patientId: string, definitionId: string, page = 1, pageSize = 20): Promise<HistoryDto> => {
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}/measurements/${definitionId}/history?page=${page}&pageSize=${pageSize}`, {
            headers: authHeaders(),
        });
        return handle(res);
    },

    // ---- Modo mock (demo), nunca llama al backend ----
    getMockSummary: (): MeasurementSummaryDto => buildMockSummary(),

    getMockHistory: (definitionId: string): HistoryDto => {
        const def = mockDefinitions.find(d => d.id === definitionId);
        const values = MOCK_BASE_VALUES[definitionId] ?? [];
        const dates = mockDates();
        const data = values.map((value, i) => ({ recordId: `mock_${definitionId}_${i}`, assessmentId: `mock_a_${definitionId}_${i}`, value, date: dates[i] }))
            .reverse();
        return {
            definition: { id: definitionId, name: def?.name ?? definitionId, unit: def?.unit ?? "" },
            data,
            meta: { page: 1, pageSize: data.length || 1, total: data.length, totalPages: 1 },
        };
    },
};
