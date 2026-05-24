# Resumen del Proyecto: Nutricion

Fecha de actualizacion: 2026-05-23

Este documento resume el estado actual del proyecto para onboarding tecnico rapido.

## Arquitectura

El proyecto esta dividido en dos aplicaciones:

- `backend/`: API NestJS con Prisma y PostgreSQL.
- `frontend/`: aplicacion Next.js con App Router.

La base de datos local se levanta con Docker Compose desde `backend/docker-compose.yml` y queda disponible en `localhost:5433`.

## Backend

Stack:

- NestJS 11.
- TypeScript.
- PostgreSQL.
- Prisma 6.
- JWT con roles.
- Swagger en `/api`.

Modulos principales:

- `auth`: registro, login, usuario autenticado y JWT.
- `patients`: CRUD de pacientes, resumen y contexto de planificacion.
- `assessments`: evaluaciones clinicas, mediciones y resultados calculados.
- `admin`: gestion de nutricionistas y estados de suscripcion.
- `health`: health check.

Seguridad:

- Roles: `ADMIN`, `NUTRITIONIST`.
- Estados de suscripcion: `TRIALING`, `ACTIVE`, `EXPIRED`, `BLOCKED`.
- Los endpoints de escritura estan protegidos por estado de suscripcion.
- Los endpoints de assessments validan pertenencia del paciente al usuario autenticado.

## Frontend

Stack:

- Next.js 16.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- `react-hook-form`, `zod`, `lucide-react`, `date-fns`, `recharts`.

Rutas principales:

- `/login`
- `/register`
- `/dashboard`
- `/patients`
- `/patients/[id]`
- `/patients/[id]/edit`
- `/admin/nutritionists`

## Base de datos

Modelos principales:

- `User`: usuarios administradores y nutricionistas.
- `Patient`: pacientes asociados a un nutricionista.
- `Assessment`: evaluacion clinica de un paciente.
- `MeasurementDefinition`: catalogo de mediciones disponibles.
- `MeasurementRecord`: valores capturados dentro de un assessment.
- `MetricDefinition`: catalogo de metricas calculadas.
- `CalculatedResult`: resultados calculados por assessment.

Tambien existen modelos legacy:

- `Measurement`
- `Result`

Estos modelos aun estan presentes y forman parte de la deuda tecnica documentada en `TECHNICAL_DEBT.md`.

## Ejecucion local

Backend:

```bash
cd backend
docker compose up -d
npm install
npx prisma generate
npx prisma migrate dev
npx ts-node prisma/seed-catalogs.ts
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

URLs:

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:4100`
- Swagger: `http://localhost:4100/api`
- PostgreSQL: `localhost:5433`

## Estado de verificacion

Verificado el 2026-05-23:

- `backend npm run build`: OK.
- `backend npm run test`: OK.
- `backend npm run test:e2e`: OK.
- `frontend npm run build`: OK.
- Lint backend/frontend: pendiente, falla por deuda tecnica conocida.

## Deuda tecnica principal

Ver `TECHNICAL_DEBT.md`.

Prioridades actuales:

1. Retirar mocks del frontend de administracion.
2. Resolver duplicidad del modelo de mediciones.
3. Limpiar lint y tipos `any`.
4. Endurecer configuracion por ambiente.
