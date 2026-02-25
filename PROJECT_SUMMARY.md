# Resumen del Proyecto: Nutrición

Este documento tiene como objetivo proporcionar contexto inmediato a cualquier IA o desarrollador que se integre al proyecto, detallando el stack tecnológico, la arquitectura actual y el estado de avance.

## 🏗️ Arquitectura y Stack Tecnológico

El proyecto es una aplicación web dividida en **Frontend** y **Backend**, con una base de datos relacional.

### 1. Backend (Directorio `/backend`)
- **Framework:** NestJS (v11)
- **Lenguaje:** TypeScript
- **Base de Datos:** PostgreSQL
- **ORM:** Prisma (v6)
- **Autenticación:** JWT usando `@nestjs/jwt`, `@nestjs/passport` y `bcrypt` para el hashing de contraseñas.
- **Documentación API:** Swagger (disponible vía `@nestjs/swagger`).
- **Módulos Principales (en `src/`):**
  - `auth/`: Manejo de autenticación y autorización.
  - `health/`: Endpoints de health check.
  - `patients/`: CRUD de pacientes.

### 2. Frontend (Directorio `/frontend`)
- **Framework:** Next.js (v16.1.4) usando el **App Router** (`app/`).
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS (v4)
- **Formularios y Validación:** `react-hook-form` administrado junto con `@hookform/resolvers` y `zod`.
- **Iconografía:** `lucide-react`.
- **Manejo de Fechas:** `date-fns`.
- **Estructura de Rutas:**
  - Rutas de aplicación principal agrupadas en `(app)`.
  - Rutas de autenticación agrupadas en `(auth)`.

### 3. Infraestructura
- **Docker Compose:** Se incluye un archivo `docker-compose.yml` en la raíz para levantar la base de datos PostgreSQL localmente de manera rápida.

---

## 🗄️ Esquema de Base de Datos (Prisma)

El modelo de datos actual soporta relaciones para la gestión de clínicas o consultas nutricionales:

- **User**: Representa a los profesionales (o administradores).
  - Incluye `id`, `email`, `passwordHash`, y un Enum `role` (`ADMIN` o `NUTRITIONIST`).
  - Relación 1 a muchos con `Patient`.
- **Patient**: Detalles demográficos y biológicos de los pacientes.
  - Campos clave: `firstName`, `lastName`, `sex` (enum), `birthDate`, `activityLevel` (enum).
  - Relación 1 a muchos con `Measurement` y `Result`.
- **Measurement**: Historial de mediciones antropométricas.
  - Campos clave: `weightKg`, `heightCm`, `waistCm`, `measuredAt`.
- **Result**: Cálculos o diagnósticos resultantes de las mediciones.
  - Campos clave: `bmi`, `bmiClass`, `tdeeKcal`.

---

## 🚀 Cómo ejecutar el proyecto en local

1. **Base de datos:** En la raíz del proyecto, ejecuta `docker compose up -d` para iniciar PostgreSQL. Alternativamente puedes explorar los datos usando `npx prisma studio`.
2. **Backend:** Dentro de `/backend`, ejecutar `npm run start:dev` (por defecto se levantará usando la configuración de NestJS).
3. **Frontend:** Dentro de `/frontend`, ejecutar `npm run dev` (levantará el entorno de Next.js típicamente en `localhost:3000`).

---

## 📍 Estado Actual (Lo que está hecho)

1. **Estructura base completa:** Los repositorios de frontend y backend ya están inicializados con sus configuraciones de linting (ESLint/Prettier) y TypeScript.
2. **Modelado de BD:** El esquema principal de Prisma está definido, abarcando Usuarios, Pacientes, Mediciones y Resultados.
3. **Módulos de Backend iniciados:** Existen los módulos para `auth`, `health` y `patients`, lo cual indica que la lógica de autenticación y la gestión básica de pacientes ya está enrutada.
4. **Layout frontend:** El App Router de Next.js está configurado, separando correctamente las rutas públicas/de ingreso (`(auth)`) de las rutas internas (`(app)`). Hay dependencias instaladas para manejar UI moderna (Tailwind, Lucide, Radix/Zod).
