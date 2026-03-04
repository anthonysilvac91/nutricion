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

const mockDefinitions: MeasurementDefinition[] = [
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

export const measurementsService = {
    getDefinitions: async (): Promise<MeasurementDefinition[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...mockDefinitions]), 400));
    },

    getPatientRecords: async (patientId: string): Promise<MeasurementRecord[]> => {
        // En una app real filtraríamos por patientId real, aquí devolveremos todo el mock si hay paciente
        return new Promise(resolve => setTimeout(() => {
            const records = mockRecords
                // .filter(r => r.patientId === patientId) // Descomentar en entorno real
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            resolve(records);
        }, 300));
    },

    addRecord: async (patientId: string, measurementId: string, value: number, date: string): Promise<MeasurementRecord> => {
        return new Promise(resolve => setTimeout(() => {
            const newRecord: MeasurementRecord = {
                id: `r_${Date.now()}`,
                patientId,
                measurementId,
                value,
                date,
            };
            mockRecords.push(newRecord);
            resolve(newRecord);
        }, 400));
    },

    deleteRecord: async (recordId: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            mockRecords = mockRecords.filter(r => r.id !== recordId);
            resolve();
        }, 400));
    },

    batchAddRecords: async (patientId: string, records: { measurementId: string, value: number }[], date: string): Promise<MeasurementRecord[]> => {
        return new Promise(resolve => setTimeout(() => {
            const newRecords: MeasurementRecord[] = records.map((rec, index) => ({
                id: `r_batch_${Date.now()}_${index}`,
                patientId,
                measurementId: rec.measurementId,
                value: rec.value,
                date,
            }));

            mockRecords.push(...newRecords);
            resolve(newRecords);
        }, 600)); // slightly longer delay for batch
    }
};
