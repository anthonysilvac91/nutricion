import { PrismaClient, FoodSourceType } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCES = [
  {
    code: 'USDA',
    name: 'USDA FoodData Central',
    region: 'US',
    type: FoodSourceType.API_CACHED,
    description: 'Base de datos nutricional del Departamento de Agricultura de EE.UU. Cobertura amplia, valores en inglés con traducción al español.',
    url: 'https://fdc.nal.usda.gov',
  },
  {
    code: 'MINSAL_CL',
    name: 'Tabla Chilena de Composición de Alimentos (MINSAL)',
    region: 'CL',
    type: FoodSourceType.SEEDED,
    description: 'Tabla oficial del Ministerio de Salud de Chile. Referencia principal para la práctica clínica en Chile.',
    url: 'https://www.minsal.cl',
  },
  {
    code: 'INTA_CL',
    name: 'INTA – Instituto de Nutrición y Tecnología de los Alimentos',
    region: 'CL',
    type: FoodSourceType.SEEDED,
    description: 'Base de datos del INTA, Universidad de Chile. Referencia académica para alimentos locales.',
    url: 'https://www.inta.cl',
  },
  {
    code: 'LATINFOODS',
    name: 'LATINFOODS (FAO/LATINFOODS)',
    region: 'LATAM',
    type: FoodSourceType.SEEDED,
    description: 'Red regional de composición de alimentos de América Latina coordinada por FAO.',
    url: 'https://www.fao.org/latinfoods',
  },
  {
    code: 'ARGENFOODS',
    name: 'ArgenFoods / ULuján',
    region: 'AR',
    type: FoodSourceType.SEEDED,
    description: 'Base de datos de composición de alimentos de Argentina, Universidad Nacional de Luján.',
    url: 'https://argenfoods.unlu.edu.ar',
  },
  {
    code: 'BEDCA',
    name: 'BEDCA – Base de Datos Española de Composición de Alimentos',
    region: 'ES',
    type: FoodSourceType.SEEDED,
    description: 'Base de datos oficial española, coordinada por la AESAN.',
    url: 'https://www.bedca.net',
  },
  {
    code: 'CESNID',
    name: 'CESNID – Centre d\'Ensenyament Superior de Nutrició i Dietètica',
    region: 'ES',
    type: FoodSourceType.ADMIN_IMPORT,
    description: 'Tabla de composición de alimentos del CESNID (Cataluña, España). Requiere digitalización manual.',
    url: null,
  },
  {
    code: 'SMAE',
    name: 'SMAE – Sistema Mexicano de Alimentos Equivalentes',
    region: 'MX',
    type: FoodSourceType.SEEDED,
    description: 'Sistema de equivalentes para planificación dietética mexicana.',
    url: null,
  },
  {
    code: 'OPEN_FOOD_FACTS',
    name: 'Open Food Facts',
    region: null,
    type: FoodSourceType.API_LIVE,
    description: 'Base de datos colaborativa de productos alimentarios comerciales con código de barras. Calidad variable.',
    url: 'https://world.openfoodfacts.org',
  },
  {
    code: 'CUSTOM',
    name: 'Alimentos personalizados',
    region: null,
    type: FoodSourceType.NUTRITIONIST,
    description: 'Alimentos creados por cada nutricionista. Solo visibles para su propia cuenta.',
    url: null,
  },
];

// Alimentos demo (USDA) para que la tabla no aparezca vacía
const DEMO_FOODS = [
  { externalId: 'usda-001', name: 'Chicken breast, roasted', nameEs: 'Pechuga de pollo asada', category: 'Carnes y aves', energy: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, sodium: 74 },
  { externalId: 'usda-002', name: 'Rice, white, cooked',     nameEs: 'Arroz blanco cocido',    category: 'Cereales y legumbres', energy: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sodium: 1 },
  { externalId: 'usda-003', name: 'Egg, whole, raw',         nameEs: 'Huevo entero crudo',     category: 'Huevos',              energy: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0.0, sodium: 142 },
  { externalId: 'usda-004', name: 'Salmon, Atlantic, raw',   nameEs: 'Salmón atlántico crudo', category: 'Pescados y mariscos', energy: 208, protein: 20.4, carbs: 0.0, fat: 13.4, fiber: 0.0, sodium: 59 },
  { externalId: 'usda-005', name: 'Avocado, raw',            nameEs: 'Palta cruda',            category: 'Frutas',              energy: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7, sodium: 7 },
  { externalId: 'usda-006', name: 'Oats, raw',               nameEs: 'Avena cruda',            category: 'Cereales y legumbres', energy: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, sodium: 2 },
  { externalId: 'usda-007', name: 'Broccoli, raw',           nameEs: 'Brócoli crudo',          category: 'Verduras',            energy: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, sodium: 33 },
  { externalId: 'usda-008', name: 'Banana, raw',             nameEs: 'Plátano crudo',          category: 'Frutas',              energy: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sodium: 1 },
  { externalId: 'usda-009', name: 'Milk, whole, 3.25%',      nameEs: 'Leche entera',           category: 'Lácteos',             energy: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0.0, sodium: 43 },
  { externalId: 'usda-010', name: 'Lentils, cooked',         nameEs: 'Lentejas cocidas',       category: 'Cereales y legumbres', energy: 116, protein: 9.0, carbs: 20.1, fat: 0.4, fiber: 7.9, sodium: 2 },
  { externalId: 'usda-011', name: 'Sweet potato, baked',     nameEs: 'Camote al horno',        category: 'Verduras',            energy: 90, protein: 2.0, carbs: 20.7, fat: 0.1, fiber: 3.3, sodium: 36 },
  { externalId: 'usda-012', name: 'Greek yogurt, plain',     nameEs: 'Yogur griego natural',   category: 'Lácteos',             energy: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fiber: 0.0, sodium: 36 },
  { externalId: 'usda-013', name: 'Almonds, raw',            nameEs: 'Almendras crudas',       category: 'Frutos secos',        energy: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, sodium: 1 },
  { externalId: 'usda-014', name: 'Spinach, raw',            nameEs: 'Espinaca cruda',         category: 'Verduras',            energy: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sodium: 79 },
  { externalId: 'usda-015', name: 'Olive oil',               nameEs: 'Aceite de oliva',        category: 'Aceites y grasas',    energy: 884, protein: 0.0, carbs: 0.0, fat: 100.0, fiber: 0.0, sodium: 2 },
];

async function main() {
  console.log('🌱 Seeding food sources...');

  for (const src of SOURCES) {
    await prisma.foodSource.upsert({
      where: { code: src.code },
      update: { name: src.name, description: src.description, url: src.url, isActive: true },
      create: src,
    });
  }
  console.log(`✅ ${SOURCES.length} fuentes nutricionales creadas/actualizadas.`);

  // Demo foods linked to USDA source
  const usdaSource = await prisma.foodSource.findUnique({ where: { code: 'USDA' } });
  if (!usdaSource) throw new Error('USDA source not found after seed');

  for (const food of DEMO_FOODS) {
    await prisma.foodItem.upsert({
      where: { sourceId_externalId: { sourceId: usdaSource.id, externalId: food.externalId } },
      update: { nameEs: food.nameEs, energy: food.energy, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber, sodium: food.sodium },
      create: { sourceId: usdaSource.id, ...food },
    });
  }
  console.log(`✅ ${DEMO_FOODS.length} alimentos demo (USDA) cargados.`);
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
