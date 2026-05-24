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

export interface MeasurementRecord {
    id: string;
    patientId: string;
    measurementId: string;
    value: number;
    date: string; // ISO date string YYYY-MM-DD
}

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
    { id: 'm_sub_fat_abd', group: 'GIRTH', name: 'Grasa subcutánea en el abdomen', unit: 'mm' }, // Asumiendo mm, ajustarlo si es % o cm
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
    { id: 'm_index_waist_height', group: 'GIRTH', name: 'Índice cintura-altura', unit: 'ratio' },
    { id: 'm_index_waist_hip', group: 'GIRTH', name: 'Índice cintura-cadera', unit: 'ratio' },
];

// Generamos datos de prueba "realistas" para ver el gráfico funcionando
const generateMockRecords = () => {
    const records: MeasurementRecord[] = [];
    const patientId = "mock-patient-1";

    // Base weight 80kg, going down to 72kg over 6 months
    let weight = 80;
    let fatPercent = 25;

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const dateStr = d.toISOString().split('T')[0];

        weight -= (Math.random() * 1.5 + 0.2); // pierde 0.2 - 1.7 kg aprox
        fatPercent -= (Math.random() * 0.8 + 0.1);

        records.push({ id: `r_w_${i}`, patientId, measurementId: 'm_weight', value: parseFloat(weight.toFixed(1)), date: dateStr });
        records.push({ id: `r_fp_${i}`, patientId, measurementId: 'm_fat_percent', value: parseFloat(fatPercent.toFixed(1)), date: dateStr });
        records.push({ id: `r_wm_${i}`, patientId, measurementId: 'm_waist', value: parseFloat((weight * 1.1).toFixed(1)), date: dateStr });
    }

    // Un par de métricas sueltas
    records.push({ id: `r_h_1`, patientId, measurementId: 'm_height', value: 175, date: '2025-01-01' });

    return records;
};

let mockRecords: MeasurementRecord[] = generateMockRecords();

const MOCK_BASE_VALUES: Record<string, number[]> = {
    // BASIC — tendencia descendente (mejora)
    'm_weight':          [80.2, 77.5, 74.8, 72.5],
    'm_height':          [165,  165,  165,  165],
    'm_hip':             [102,  100,  99,   97],
    'm_waist':           [88,   86,   84,   82],
    // COMPOSITION
    'm_visceral_fat':    [11,   10,   9,    8],
    'm_fat_mass':        [24.1, 22.8, 21.4, 20.3],
    'm_fat_free_mass':   [56.1, 54.7, 53.4, 52.2],
    'm_lean_mass':       [53.2, 52.0, 50.8, 49.8],
    'm_muscle_mass':     [39.1, 38.2, 37.3, 36.4],
    'm_bone_mass':       [2.9,  2.8,  2.8,  2.7],
    'm_fat_percent':     [30.1, 29.4, 28.7, 28.1],
    // SKINFOLD
    'sf_abdominal':      [22,   21,   19,   18],
    'sf_mid_axillary':   [14,   13,   12,   12],
    'sf_bicep':          [12,   11,   10,   10],
    'sf_calf':           [16,   15,   14,   14],
    'sf_iliocristale':   [25,   24,   23,   22],
    'sf_pectoral':       [11,   10,   9,    9],
    'sf_subscapular':    [18,   17,   16,   15],
    'sf_supraspinale':   [19,   18,   17,   16],
    'sf_suprailiac':     [22,   21,   20,   19],
    'sf_tricep':         [21,   20,   19,   18],
    'sf_front_thigh':    [23,   22,   21,   20],
    'sf_sum_5':          [98,   93,   88,   85],
    'sf_sum_8':          [152,  144,  137,  130],
    // GIRTH
    'm_dia_femur':       [9.5,  9.4,  9.3,  9.2],
    'm_dia_wrist':       [5.6,  5.5,  5.4,  5.4],
    'm_dia_elbow':       [6.3,  6.2,  6.2,  6.1],
    'm_dia_ankle':       [7.0,  6.9,  6.9,  6.8],
    'm_sub_fat_abd':     [17,   16,   15,   14],
    'm_cir_abdominal':   [89,   87,   86,   85],
    'm_cir_head':        [56,   56,   56,   56],
    'm_cir_shoulder':    [104,  103,  103,  102],
    'm_cir_wrist':       [15.8, 15.7, 15.6, 15.5],
    'm_cir_upper_thigh': [60,   59,   59,   58],
    'm_cir_forearm':     [28,   27,   27,   27],
    'm_cir_arm':         [32,   32,   31,   31],
    'm_cir_arm_flexed':  [34,   34,   33,   33],
    'm_cir_arm_relaxed': [31,   31,   30,   30],
    'm_cir_neck':        [35,   35,   34,   34],
    'm_cir_ankle':       [23,   22,   22,   22],
    'm_cir_calf':        [39,   39,   38,   38],
    'm_cir_mid_thigh':   [55,   55,   54,   54],
    'm_cir_chest':       [94,   93,   93,   92],
    'm_index_waist_height': [0.53, 0.52, 0.51, 0.50],
    'm_index_waist_hip':    [0.86, 0.86, 0.85, 0.84],
};

export function generateAllMockRecords(patientId: string): MeasurementRecord[] {
    const records: MeasurementRecord[] = [];
    const dates = [3, 2, 1, 0].map(monthsAgo => {
        const d = new Date();
        d.setMonth(d.getMonth() - monthsAgo);
        return d.toISOString().split('T')[0];
    });

    for (const def of mockDefinitions) {
        const values = MOCK_BASE_VALUES[def.id];
        if (!values) continue;
        values.forEach((value, i) => {
            records.push({
                id: `mock_${def.id}_${i}`,
                patientId,
                measurementId: def.id,
                value,
                date: dates[i],
            });
        });
    }

    // Sort descending by date (newest first)
    return records.sort((a, b) => b.date.localeCompare(a.date));
}

// Retirada gradual: mantenemos las definiciones mockeadas por ahora, 
// a la espera de un endpoint de diccionarios en próximas fases.
export const measurementsService = {
    getDefinitions: async (): Promise<MeasurementDefinition[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...mockDefinitions]), 400));
    },

    getPatientRecords: async (patientId: string): Promise<MeasurementRecord[]> => {
        // MIGRACIÓN: Ahora sí consumimos el backend real usando fetch
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch(`${API_BASE_URL}/patients/${patientId}/assessments/latest`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                if (res.status === 404) return []; // No assessments yet
                throw new Error('Failed to fetch assessments');
            }

            const assessment = await res.json();

            // Adaptador: Convertimos el MeasurementRecord de Prisma al MeasurementRecord del Frontend
            if (!assessment || !assessment.measurements) return [];

            return assessment.measurements.map((m: any) => ({
                id: m.id,
                patientId: patientId,
                measurementId: m.definitionId,
                value: m.numericValue, // El frontend por ahora solo pinta valores numéricos 
                date: assessment.date.split('T')[0]
            }));

        } catch (error) {
            console.error("Error fetching patient records:", error);
            return []; // Fallback a vacío si falla la red en lugar del mock 
        }
    },

    addRecord: async (patientId: string, measurementId: string, value: number, date: string): Promise<MeasurementRecord> => {
        // Wrapper legacy over batch insert
        const res = await measurementsService.batchAddRecords(patientId, [{ measurementId, value }], date);
        return res[0];
    },

    deleteRecord: async (recordId: string): Promise<void> => {
        // En la nueva arquitectura, no se borran records individuales sino que se inactiva el Assessment o se hace un PATCH.
        // Dado que el UI actual espera esta función, la mockeamos vacía para no romper la transición.
        console.warn('Individual record deletion is deprecated in the new assessment model.');
        return Promise.resolve();
    },

    batchAddRecords: async (patientId: string, records: { measurementId: string, value: number }[], date: string): Promise<MeasurementRecord[]> => {
        try {
            const token = localStorage.getItem('token') || '';
            const payload = {
                date: new Date(date).toISOString(),
                status: 'COMPLETED',
                measurements: records.map(r => ({
                    definitionId: r.measurementId,
                    numericValue: r.value
                }))
            };

            const res = await fetch(`${API_BASE_URL}/patients/${patientId}/assessments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save assessment');

            const assessment = await res.json();

            return assessment.measurements.map((m: any) => ({
                id: m.id,
                patientId: patientId,
                measurementId: m.definitionId,
                value: m.numericValue,
                date: assessment.date.split('T')[0]
            }));

        } catch (error) {
            console.error("Error saving assessment batch:", error);
            throw error;
        }
    }
};
