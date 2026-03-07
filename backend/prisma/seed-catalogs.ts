import { PrismaClient, MeasurementGroup, MetricCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Measurement Definitions...');
  
  await prisma.measurementDefinition.createMany({
    skipDuplicates: true,
    data: [
      { id: 'm_weight', group: MeasurementGroup.BASIC, name: 'Peso', unit: 'kg' },
      { id: 'm_height', group: MeasurementGroup.BASIC, name: 'Estatura', unit: 'cm' },
      { id: 'm_waist', group: MeasurementGroup.BASIC, name: 'Perímetro de la cintura', unit: 'cm' },
      { id: 'm_hip', group: MeasurementGroup.BASIC, name: 'Perímetro de la cadera', unit: 'cm' },
      
      { id: 'sf_tricep', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo tricipital', unit: 'mm' },
      { id: 'sf_bicep', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo bicipital', unit: 'mm' },
      { id: 'sf_subscapular', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo subescapular', unit: 'mm' },
      { id: 'sf_suprailiac', group: MeasurementGroup.SKINFOLD, name: 'Pliegue cutáneo suprailíaco', unit: 'mm' },
      
      { id: 'm_blood_pressure', group: MeasurementGroup.CLINICAL_MARKER, name: 'Presión Arterial', unit: 'mmHg', description: 'Formato Sistólica/Diastólica' },
    ]
  });

  console.log('🌱 Seeding Metric Definitions...');
  
  await prisma.metricDefinition.createMany({
    skipDuplicates: true,
    data: [
      { id: 'BMI', category: MetricCategory.INDEX, name: 'Índice de Masa Corporal (IMC)' },
      { id: 'BODY_FAT_PERCENTAGE', category: MetricCategory.COMPOSITION, name: 'Porcentaje de Grasa Corporal' },
      { id: 'WAIST_TO_HIP_RATIO', category: MetricCategory.INDEX, name: 'Índice Cintura-Cadera' },
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
