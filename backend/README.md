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

Aplicar migraciones (desarrollo local -- crea/ajusta migraciones interactivamente):

```bash
npx prisma migrate dev
```

En producción las migraciones se aplican con `npx prisma migrate deploy`
(aplica las migraciones ya existentes en el repo, no crea ninguna nueva).

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

### Fundación Workspace (fase Consulta Clínica)

`Patient.workspaceId` es **obligatorio** (`NOT NULL`) desde la migración
`20260808151040_require_patient_workspace`. El FK `Patient.workspaceId ->
Workspace.id` usa `ON DELETE RESTRICT ON UPDATE CASCADE`: un `Workspace` con
al menos un `Patient` asociado no puede eliminarse, y un `Patient` nunca
queda huérfano de Workspace (antes de esta migración el FK usaba `ON DELETE
SET NULL`, incoherente con una columna obligatoria).

Todo `NUTRITIONIST` nuevo recibe su Workspace PERSONAL y su membresía OWNER
atómicamente durante `POST /auth/register` (misma transacción que la
creación del `User`). `PatientsService.create()` conserva una resolución
idempotente del Workspace como red de seguridad para cualquier caso no
cubierto por el registro (`ADMIN` con pacientes, etc.).

**Historial de despliegue (corte 1, ya ejecutado y verificado en
producción):**

```bash
# Migración A: crea Workspace, WorkspaceMember y Patient.workspaceId (nullable en ese momento)
npx prisma migrate deploy

# Backfill idempotente: crea un Workspace PERSONAL por NUTRITIONIST y por
# ADMIN con pacientes, y asocia cada Patient existente. Seguro de re-ejecutar.
npx ts-node prisma/backfill-workspaces.ts

# Verificación de solo lectura -- debe salir con código 0
npx ts-node prisma/verify-workspace-backfill.ts
```

`backfill-workspaces.ts` y `verify-workspace-backfill.ts` se conservan en el
repositorio como parte de ese proceso histórico y siguen siendo seguros de
ejecutar repetidamente (no duplican Workspaces ni memberships, no reasignan
pacientes ya asociados) -- útiles como chequeo de salud aunque la columna ya
sea obligatoria.

**Migración B (ya aplicada):** una vez confirmado en producción que la
verificación anterior salía con código 0, se desplegó
`20260808151040_require_patient_workspace`, que agrega un guard explícito
(`DO $$ ... RAISE EXCEPTION`) que aborta la migración completa si encuentra
algún `Patient.workspaceId IS NULL` -- no hace ningún `UPDATE` ni asigna
Workspaces por su cuenta -- y luego aplica `SET NOT NULL` y reemplaza el FK
por `ON DELETE RESTRICT`. En producción se aplica igual que cualquier otra
migración:

```bash
npx prisma migrate deploy
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
