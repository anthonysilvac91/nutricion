# Backend Nutricion

API NestJS para gestion de nutricionistas, pacientes, assessments clinicos y calculos nutricionales.

## Stack

- NestJS 11.
- TypeScript.
- Prisma 6.
- PostgreSQL 16.
- JWT.
- Swagger.

## Configuracion

Crear o revisar `.env`:

```env
DATABASE_URL="postgresql://nutricion_user:nutricion_pass@localhost:5433/nutricion?schema=public"
JWT_SECRET="secret_super_seguro_123"
JWT_EXPIRES_IN=1d
PORT=4100
ADMIN_EMAIL="admin@nutriapp.com"
ADMIN_PASSWORD="admin123"
```

La base local usa puerto `5433` en el host. El puerto `5432` puede estar ocupado por otros proyectos.

## Base de datos

Levantar PostgreSQL:

```bash
docker compose up -d
```

Validar conexion y migraciones:

```bash
npx prisma migrate status
```

Aplicar migraciones:

```bash
npx prisma migrate dev
```

Generar cliente Prisma:

```bash
npx prisma generate
```

Seed de catalogos:

```bash
npx ts-node prisma/seed-catalogs.ts
```

Seed demo:

```bash
npx prisma db seed
```

## Ejecucion

```bash
npm install
npm run start:dev
```

URLs:

- API: `http://localhost:4100`
- Swagger: `http://localhost:4100/api`

## Tests

```bash
npm run build
npm run test
npm run test:e2e
```

Estado verificado el 2026-05-23:

- Build: OK.
- Unit tests: OK.
- E2E tests: OK.
- Lint: pendiente por deuda tecnica.

## Modulos

- `auth`: login, registro y usuario autenticado.
- `patients`: CRUD de pacientes, resumen y contexto de planificacion.
- `assessments`: evaluaciones, mediciones y resultados calculados.
- `admin`: gestion de nutricionistas y suscripciones.
- `health`: health check.

## Notas tecnicas

- Los endpoints de assessments validan que el paciente pertenezca al usuario autenticado.
- Existen modelos legacy `Measurement` y `Result`; la arquitectura nueva usa `Assessment`, `MeasurementRecord` y `CalculatedResult`.
- La deuda tecnica priorizada esta en `../TECHNICAL_DEBT.md`.
