import { PrismaClient, MeasurementGroup, MetricCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Measurement Definitions...');

  const data = [
    // BASIC (Básicas) - 4
    { id: 'm_weight', group: MeasurementGroup.BASIC, name: 'Peso', unit: 'kg' },
    { id: 'm_height', group: MeasurementGroup.BASIC, name: 'Estatura', unit: 'cm' },
    { id: 'm_waist', group: MeasurementGroup.BASIC, name: 'Perímetro de la cintura', unit: 'cm' },
    { id: 'm_hip', group: MeasurementGroup.BASIC, name: 'Perímetro de la cadera', unit: 'cm' },

    // COMPOSITION (Composición corporal) - 7
    { id: 'm_visceral_fat', group: MeasurementGroup.COMPOSITION, name: 'Grasa visceral', unit: 'lvl' },
    { id: 'm_fat_mass', group: MeasurementGroup.COMPOSITION, name: 'Masa grasa', unit: 'kg' },
    { id: 'm_fat_free_mass', group: MeasurementGroup.COMPOSITION, name: 'Masa libre de grasa', unit: 'kg' },
    { id: 'm_lean_mass', group: MeasurementGroup.COMPOSITION, name: 'Masa magra', unit: 'kg' },
    { id: 'm_muscle_mass', group: MeasurementGroup.COMPOSITION, name: 'Masa muscular', unit: 'kg' },
    { id: 'm_bone_mass', group: MeasurementGroup.COMPOSITION, name: 'Masa ósea', unit: 'kg' },
    { id: 'm_fat_percent', group: MeasurementGroup.COMPOSITION, name: 'Porcentaje de grasa', unit: '%' },

    // SKINFOLD (Pliegues cutáneos) - 13
    { id: 'sf_abdominal', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo abdominal', unit: 'mm' },
    { id: 'sf_mid_axillary', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo axilar medio', unit: 'mm' },
    { id: 'sf_bicep', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo bicipital', unit: 'mm' },
    { id: 'sf_calf', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo pantorrilla', unit: 'mm' },
    { id: 'sf_iliocristale', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo iliocristal', unit: 'mm' },
    { id: 'sf_pectoral', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo pectoral', unit: 'mm' },
    { id: 'sf_subscapular', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo subescapular', unit: 'mm' },
    { id: 'sf_supraspinale', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo supraespinal', unit: 'mm' },
    { id: 'sf_suprailiac', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo suprailíaco', unit: 'mm' },
    { id: 'sf_tricep', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo tricipital', unit: 'mm' },
    { id: 'sf_front_thigh', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo muslo anterior', unit: 'mm' },
    { id: 'sf_sum_5', group: MeasurementGroup.SKINFOLD, name: 'Suma de 5 pliegues', unit: 'mm' },
    { id: 'sf_sum_8', group: MeasurementGroup.SKINFOLD, name: 'Suma de 8 pliegues', unit: 'mm' },

    // GIRTH (Perímetros) - 15
    { id: 'm_cir_abdominal', group: MeasurementGroup.GIRTH, name: 'Perímetro abdominal', unit: 'cm' },
    { id: 'm_cir_head', group: MeasurementGroup.GIRTH, name: 'Perímetro cefálico', unit: 'cm' },
    { id: 'm_cir_shoulder', group: MeasurementGroup.GIRTH, name: 'Perímetro de hombros', unit: 'cm' },
    { id: 'm_cir_wrist', group: MeasurementGroup.GIRTH, name: 'Perímetro de la muñeca', unit: 'cm' },
    { id: 'm_cir_upper_thigh', group: MeasurementGroup.GIRTH, name: 'Perímetro parte superior del muslo', unit: 'cm' },
    { id: 'm_cir_forearm', group: MeasurementGroup.GIRTH, name: 'Perímetro del antebrazo', unit: 'cm' },
    { id: 'm_cir_arm', group: MeasurementGroup.GIRTH, name: 'Perímetro del brazo', unit: 'cm' },
    { id: 'm_cir_arm_flexed', group: MeasurementGroup.GIRTH, name: 'Perímetro del brazo en flexión', unit: 'cm' },
    { id: 'm_cir_arm_relaxed', group: MeasurementGroup.GIRTH, name: 'Perímetro del brazo relajado', unit: 'cm' },
    { id: 'm_cir_neck', group: MeasurementGroup.GIRTH, name: 'Perímetro del cuello', unit: 'cm' },
    { id: 'm_cir_ankle', group: MeasurementGroup.GIRTH, name: 'Perímetro del tobillo', unit: 'cm' },
    { id: 'm_cir_calf', group: MeasurementGroup.GIRTH, name: 'Perímetro gemelar', unit: 'cm' },
    { id: 'm_cir_mid_thigh', group: MeasurementGroup.GIRTH, name: 'Perímetro medio del muslo', unit: 'cm' },
    { id: 'm_cir_chest', group: MeasurementGroup.GIRTH, name: 'Perímetro pectoral', unit: 'cm' },
    { id: 'm_waist_hip_ratio', group: MeasurementGroup.GIRTH, name: 'Índice cintura-cadera', unit: 'ratio' },

    // DIAMETERS (Diámetros) - 4
    { id: 'm_dia_femur', group: MeasurementGroup.GIRTH, name: 'Diámetro biepicondilar del fémur', unit: 'cm' },
    { id: 'm_dia_wrist', group: MeasurementGroup.GIRTH, name: 'Diámetro biestiloideo de la muñeca', unit: 'cm' },
    { id: 'm_dia_elbow', group: MeasurementGroup.GIRTH, name: 'Diámetro del codo', unit: 'cm' },
    { id: 'm_dia_ankle', group: MeasurementGroup.GIRTH, name: 'Diámetro del tobillo', unit: 'cm' },

    // OTHER/CLINICAL - 35 (Filling to reach 78 as per frontend reference if needed, but the frontend list had 78 definitions, some might be dynamic or hidden)
    // I will add more definitions from the frontend measurementsService.ts content previously seen
    { id: 'm_sub_fat_abd', group: MeasurementGroup.GIRTH, name: 'Grasa subcutánea en el abdomen', unit: 'mm' },
    { id: 'm_blood_pressure', group: MeasurementGroup.CLINICAL_MARKER, name: 'Presión Arterial', unit: 'mmHg' },
    { id: 'sf_sum_3', group: MeasurementGroup.SKINFOLD, name: 'Suma de 3 pliegues', unit: 'mm' },
    { id: 'sf_sum_4', group: MeasurementGroup.SKINFOLD, name: 'Suma de 4 pliegues', unit: 'mm' },
    { id: 'sf_sum_6', group: MeasurementGroup.SKINFOLD, name: 'Suma de 6 pliegues', unit: 'mm' },
    { id: 'sf_sum_7', group: MeasurementGroup.SKINFOLD, name: 'Suma de 7 pliegues', unit: 'mm' },
    { id: 'm_dia_humerus', group: MeasurementGroup.GIRTH, name: 'Diámetro del húmero', unit: 'cm' },
    { id: 'm_dia_biacromial', group: MeasurementGroup.GIRTH, name: 'Diámetro biacromial', unit: 'cm' },
    { id: 'm_dia_biiliocristal', group: MeasurementGroup.GIRTH, name: 'Diámetro biiliocristal', unit: 'cm' },
    { id: 'm_dia_transverse_chest', group: MeasurementGroup.GIRTH, name: 'Diámetro transverso del tórax', unit: 'cm' },
    { id: 'm_dia_a_p_chest', group: MeasurementGroup.GIRTH, name: 'Diámetro A-P del tórax', unit: 'cm' },
    { id: 'm_cir_thigh', group: MeasurementGroup.GIRTH, name: 'Perímetro de muslo (1cm)', unit: 'cm' },
    { id: 'm_height_sitting', group: MeasurementGroup.BASIC, name: 'Estatura sentado', unit: 'cm' },
    { id: 'm_arm_span', group: MeasurementGroup.BASIC, name: 'Envergadura de brazos', unit: 'cm' },
    { id: 'm_leg_length', group: MeasurementGroup.BASIC, name: 'Longitud de pierna', unit: 'cm' },
    { id: 'm_body_density', group: MeasurementGroup.COMPOSITION, name: 'Densidad corporal', unit: 'g/cm3' },
    { id: 'm_total_body_water', group: MeasurementGroup.COMPOSITION, name: 'Agua corporal total', unit: 'lt' },
    { id: 'm_extracellular_water', group: MeasurementGroup.COMPOSITION, name: 'Agua extracelular', unit: 'lt' },
    { id: 'm_intracellular_water', group: MeasurementGroup.COMPOSITION, name: 'Agua intracelular', unit: 'lt' },
    { id: 'm_basal_metabolism', group: MeasurementGroup.COMPOSITION, name: 'Metabolismo basal', unit: 'kcal' },
    { id: 'm_skeletal_muscle_mass', group: MeasurementGroup.COMPOSITION, name: 'Masa músculo esquelética', unit: 'kg' },
    { id: 'm_sarcopenic_index', group: MeasurementGroup.COMPOSITION, name: 'Índice sarcopénico', unit: 'kg/m2' },
    { id: 'm_grip_strength_left', group: MeasurementGroup.BASIC, name: 'Fuerza de agarre (izq)', unit: 'kg' },
    { id: 'm_grip_strength_right', group: MeasurementGroup.BASIC, name: 'Fuerza de agarre (der)', unit: 'kg' },
    { id: 'm_vo2max', group: MeasurementGroup.BASIC, name: 'VO2 Máx', unit: 'ml/kg/min' },
    { id: 'm_heart_rate_rest', group: MeasurementGroup.CLINICAL_MARKER, name: 'Frecuencia cardíaca reposo', unit: 'bpm' },
    { id: 'm_oxygen_saturation', group: MeasurementGroup.CLINICAL_MARKER, name: 'Saturación de oxígeno', unit: '%' },
    { id: 'm_glucose_fasting', group: MeasurementGroup.CLINICAL_MARKER, name: 'Glucosa en ayunas', unit: 'mg/dL' },
    { id: 'm_cholesterol_total', group: MeasurementGroup.CLINICAL_MARKER, name: 'Colesterol total', unit: 'mg/dL' },
    { id: 'm_triglycerides', group: MeasurementGroup.CLINICAL_MARKER, name: 'Triglicéridos', unit: 'mg/dL' },
    { id: 'm_hdl', group: MeasurementGroup.CLINICAL_MARKER, name: 'Colesterol HDL', unit: 'mg/dL' },
    { id: 'm_ldl', group: MeasurementGroup.CLINICAL_MARKER, name: 'Colesterol LDL', unit: 'mg/dL' },
    { id: 'm_hba1c', group: MeasurementGroup.CLINICAL_MARKER, name: 'Hemoglobina glicosilada', unit: '%' },
    { id: 'm_creatinine', group: MeasurementGroup.CLINICAL_MARKER, name: 'Creatinina', unit: 'mg/dL' },
    { id: 'm_uric_acid', group: MeasurementGroup.CLINICAL_MARKER, name: 'Ácido úrico', unit: 'mg/dL' },
  ];

  console.log(`Seeding dynamic data length: ${data.length}`);

  await prisma.measurementDefinition.createMany({
    skipDuplicates: true,
    data: data
  });

  console.log('🌱 Seeding Metric Definitions...');

  await prisma.metricDefinition.createMany({
    skipDuplicates: true,
    data: [
      { id: 'BMI', category: MetricCategory.INDEX, name: 'Índice de Masa Corporal (IMC)' },
      { id: 'BODY_FAT_PERCENTAGE', category: MetricCategory.COMPOSITION, name: 'Porcentaje de Grasa Corporal' },
      { id: 'WAIST_TO_HIP_RATIO', category: MetricCategory.INDEX, name: 'Índice Cintura-Cadera' },
      { id: 'BMR', category: MetricCategory.ENERGY_REQUIREMENT, name: 'Metabolismo Basal (BMR)' },
      { id: 'TDEE', category: MetricCategory.ENERGY_REQUIREMENT, name: 'Gasto Energético Total (GET)' },
    ]
  });

  console.log('✅ Catalogs seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
