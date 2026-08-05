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

### Fundación Workspace (corte 1 de la fase Consulta Clínica)

`Patient.workspaceId` es nullable en este release a propósito -- la migración
que la vuelve `NOT NULL` se despliega por separado, en un release posterior,
después de correr y verificar el backfill en producción. **No incluir esa
migración en el mismo release que ejecuta el backfill.**

Desde este release, todo `NUTRITIONIST` nuevo recibe su Workspace PERSONAL y
su membresía OWNER atómicamente durante `POST /auth/register` (misma
transacción que la creación del `User`). `PatientsService.create()` conserva
una resolución perezosa e idempotente del Workspace como red de seguridad para
cualquier caso no cubierto por el registro (usuarios creados antes de este
cambio, `ADMIN` con pacientes, etc.).

**Release 1 -- fundación + backfill (esta rama):**

```bash
# Crea Workspace, WorkspaceMember y Patient.workspaceId (nullable)
npx prisma migrate deploy

# Backfill idempotente: crea un Workspace PERSONAL por NUTRITIONIST y por
# ADMIN con pacientes, y asocia cada Patient existente. Seguro de re-ejecutar.
npx ts-node prisma/backfill-workspaces.ts

# Verificación de solo lectura -- debe salir con código 0
npx ts-node prisma/verify-workspace-backfill.ts
```

`backfill-workspaces.ts` y `verify-workspace-backfill.ts` no requieren ningún
argumento y son seguros de ejecutar repetidamente (no duplican Workspaces ni
memberships, no reasignan pacientes ya asociados). Antes de continuar al
release 2, confirmar en producción que la verificación sale con código 0.

**Release 2 -- migración NOT NULL (rama/PR separado, posterior):**

Agregar y desplegar la migración que aplica `Patient.workspaceId NOT NULL`
(con el guard que aborta si queda algún paciente sin workspace) solo después
de que el release 1 lleve corriendo el tiempo suficiente para que el registro
atómico y el fallback de `PatientsService.create()` hayan cubierto cualquier
escritura nueva, y de que el backfill + verificación se hayan confirmado en
producción.

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
