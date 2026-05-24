# Deuda tecnica del proyecto Nutricion

Fecha de revision: 2026-05-23

Este documento resume la deuda tecnica identificada en el proyecto, separada por prioridad. El objetivo es dejar claro que riesgos existen, que impacto tienen y que acciones conviene tomar para llevar el sistema desde un MVP funcional hacia una base mantenible.

## Resumen ejecutivo

El proyecto esta en estado de MVP funcional avanzado. Backend y frontend compilan, y los tests unitarios del backend pasan. Sin embargo, existen inconsistencias importantes entre documentacion, codigo, datos de prueba y contratos frontend/backend.

La deuda mas relevante pendiente esta en estas areas:

1. Modelo de mediciones duplicado entre arquitectura antigua y nueva.
2. Lint y tipos `any` pendientes.
3. Configuracion por ambiente todavia basica.
4. Documentacion profunda de contratos API pendiente.

## Prioridad alta

### 1. Falta validacion de pertenencia en assessments

**Estado:** Resuelto el 2026-05-23.

Los endpoints de assessments recibian `patientId`, pero no validaban que el paciente perteneciera al usuario autenticado.

Ahora el controller pasa `req.user.sub` al service y el service valida pertenencia antes de crear o leer assessments.

**Archivos relacionados:**

- `backend/src/assessments/assessments.controller.ts`
- `backend/src/assessments/assessments.service.ts`

**Impacto previo:**

Un nutricionista podria crear o leer assessments de pacientes ajenos si conoce o adivina un ID valido.

**Accion realizada:**

Se agregaron validaciones y tests unitarios/e2e de acceso cruzado entre usuarios.

### 2. Frontend de administracion usaba datos mock

**Estado:** Resuelto el 2026-05-23.

La pantalla de administracion de nutricionistas usaba una base en memoria dentro de `nutritionistsService.ts`.

Ahora consume la API real:

- `GET /admin/nutritionists`
- `PATCH /admin/nutritionists/:id`

**Archivo relacionado:**

- `frontend/services/nutritionistsService.ts`

**Impacto previo:**

La UI puede mostrar comportamientos que no existen realmente en produccion. Crear, editar, eliminar o resetear usuarios desde esa pantalla no persiste en backend.

**Accion realizada:**

Se retiraron los mocks y tambien las acciones simuladas no soportadas por backend.

**Pendiente relacionado:**

Si se requiere crear, eliminar o resetear contrasena de nutricionistas desde admin, deben agregarse endpoints reales en backend.

### 3. Modelo de mediciones duplicado

**Estado:** Resuelto el 2026-05-23.

El esquema Prisma mantiene dos modelos de dominio para mediciones:

- Modelo antiguo: `Measurement` y `Result`.
- Modelo nuevo: `Assessment`, `MeasurementRecord` y `CalculatedResult`.

El seed principal todavia crea registros en el modelo antiguo, mientras parte del frontend ya consume assessments.

**Archivos relacionados:**

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/patients/patients.service.ts`
- `backend/src/assessments/assessments.service.ts`
- `frontend/services/measurementsService.ts`

**Impacto:**

El dominio queda ambiguo. Nuevas funcionalidades pueden leer o escribir en tablas distintas, generando datos inconsistentes y bugs dificiles de rastrear.

**Accion recomendada:**

Definir una arquitectura final:

- O migrar completamente a assessments y retirar `Measurement`/`Result`.
- O documentar explicitamente que `Measurement`/`Result` son compatibilidad historica y aislar su uso.

Despues, actualizar seeds, servicios, documentacion y tests para usar una sola fuente de verdad.

### 4. Tests e2e no reproducibles

**Estado:** Alto.

El reporte `tests_report.md` indicaba que los e2e pasaron previamente, pero la ejecucion local fallaba por autenticacion contra PostgreSQL con el usuario `nutricion_user`.

Se corrigio el conflicto de puertos: Nutricion usa `localhost:5433` y los e2e pasan localmente.

**Archivos relacionados:**

- `backend/test/assessments.e2e-spec.ts`
- `backend/test/app.e2e-spec.ts`
- `backend/docker-compose.yml`
- `backend/.env.example`
- `tests_report.md`

**Impacto previo:**

No hay garantia reproducible de flujos reales con base de datos. El reporte historico puede dar una falsa sensacion de cobertura.

**Pendiente recomendado:**

Aunque los e2e ya son reproducibles localmente, todavia conviene crear una estrategia e2e mas aislada:

- Base de datos de test separada.
- Variables `.env.test` o setup documentado.
- Migraciones y seed de catalogos antes de correr e2e.
- Limpieza de datos despues de cada suite.

## Prioridad media

### 5. Lint no pasa

**Estado:** Medio.

Backend y frontend compilan, pero lint falla.

**Backend:**

Se detectaron cientos de errores, principalmente formato Prettier, `any` inseguro e imports sin uso.

**Frontend:**

Se detectaron errores de `any`, hooks con dependencias faltantes, imports sin uso, reglas React y tipos vacios.

**Impacto:**

El build puede pasar aunque el codigo tenga problemas de mantenibilidad. Ademas, si se activa CI estricto, el proyecto fallara.

**Accion recomendada:**

Separar la correccion en dos fases:

1. Ejecutar y revisar formato automatico.
2. Corregir tipos `any`, hooks y reglas React manualmente.

Luego dejar `lint` como requisito de CI.

### 6. Documentacion minima actualizada, falta profundizar

**Estado:** Bajo a medio.

El 2026-05-23 se actualizaron los documentos principales de setup y resumen para reflejar el estado actual del proyecto, incluyendo el puerto PostgreSQL `5433`, Docker Compose en `backend/`, comandos de migracion, seeds y tests.

Todavia falta documentacion mas profunda de contratos API, flujos funcionales y decisiones de dominio.

**Archivos relacionados:**

- `README` o `readme`
- `PROJECT_SUMMARY.md`
- `backend/README.md`
- `frontend/README.md`

**Ya corregido:**

- Ubicacion real de `docker-compose.yml`.
- Puerto local `5433` para PostgreSQL.
- Variables `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- Flujo basico de migraciones y seed de catalogos.
- Alcance funcional actual de backend y frontend.

**Accion recomendada:**

Agregar documentacion complementaria cuando el dominio se estabilice:

- Contratos API principales.
- Ejemplos de payloads para assessments.
- Politica de permisos por rol y suscripcion.
- Decision final sobre modelos legacy `Measurement` y `Result`.
- Guia de troubleshooting para Docker/Prisma.

### 7. Contratos frontend/backend debiles

**Estado:** Medio.

El frontend usa varios `any`, adapta manualmente respuestas y construye payloads con reglas fragiles, por ejemplo separando `name` en `firstName` y `lastName`.

**Archivos relacionados:**

- `frontend/lib/api.ts`
- `frontend/services/measurementsService.ts`
- Paginas de pacientes, login, register y admin.

**Impacto:**

Cambios pequenos en backend pueden romper UI sin aviso de TypeScript. Tambien hay riesgo de errores con nombres compuestos, fechas y campos faltantes.

**Accion recomendada:**

Definir tipos compartidos o contratos explicitos por endpoint. Al menos, crear interfaces frontend para respuestas y payloads criticos:

- Auth.
- Patient.
- Patient summary.
- Assessment.
- Measurement definition.
- Admin nutritionist.

### 8. Configuracion de puerto inconsistente

**Estado:** Medio.

`AppModule` valida `PORT`, pero `main.ts` escucha fijo en `4000`.

**Archivo relacionado:**

- `backend/src/main.ts`
- `backend/src/app.module.ts`

**Impacto:**

La variable `PORT` puede dar una falsa expectativa en despliegues o entornos locales.

**Accion recomendada:**

Usar `ConfigService` en `main.ts` para leer `PORT`.

### 9. CORS permisivo

**Estado:** Medio.

El backend habilita CORS con `origin: true` y `credentials: true`.

**Archivo relacionado:**

- `backend/src/main.ts`

**Impacto:**

Acepta origenes dinamicamente. Para desarrollo es practico, pero en produccion conviene restringir dominios.

**Accion recomendada:**

Agregar variable de entorno para origen permitido, por ejemplo `FRONTEND_URL`, y usar una lista controlada por ambiente.

## Prioridad baja

### 10. Seeds incompletos o mezclados

**Estado:** Bajo a medio.

Existen seeds para usuario/paciente y para catalogos, pero el flujo no esta claramente documentado. Ademas, el seed principal usa el modelo antiguo de mediciones.

**Archivos relacionados:**

- `backend/prisma/seed.ts`
- `backend/prisma/seed-catalogs.ts`

**Accion recomendada:**

Separar seeds por proposito:

- `seed:catalogs`
- `seed:demo`
- `seed:test`

Documentar el orden correcto.

### 11. Reportes manuales pueden quedar obsoletos

**Estado:** Bajo.

`tests_report.md` contiene una ejecucion historica de tests, pero no representa necesariamente el estado actual.

**Impacto:**

Puede confundir a futuros desarrolladores.

**Accion recomendada:**

Convertir el reporte en una nota historica o reemplazarlo por instrucciones de ejecucion. Los resultados deberian provenir de CI o comandos reproducibles.

### 12. Archivos generados locales presentes en workspace

**Estado:** Bajo.

Durante builds aparecen carpetas como `backend/dist` y `frontend/.next`. Estan ignoradas por git, pero conviene evitar usarlas como fuente de verdad durante revisiones.

**Accion recomendada:**

Mantener `.gitignore` y documentar que esos directorios son artefactos locales.

## Alcance funcional actual

El alcance real del sistema, segun el codigo, incluye:

- Registro y login con JWT.
- Roles de usuario.
- Usuario administrador.
- Nutricionistas con estado de suscripcion/trial.
- CRUD de pacientes.
- Resumen de paciente.
- Contexto de planificacion.
- Registro de assessments clinicos.
- Mediciones por definicion.
- Resultados calculados.
- Frontend con rutas protegidas, pacientes, detalle, mediciones y administracion.

## Recomendacion de roadmap tecnico

### Fase 1: Seguridad y consistencia minima

Estado: completada el 2026-05-23.

1. Autorizacion de assessments corregida.
2. Tests de acceso cruzado agregados.
3. E2E reproducible contra PostgreSQL local en `localhost:5433`.
4. Setup real documentado.

### Fase 2: Retirar mocks y alinear dominio

1. Conectar admin frontend con API real. Completado el 2026-05-23.
2. Crear endpoint real para definiciones de mediciones.
3. Decidir y ejecutar migracion del modelo antiguo de mediciones.
4. Actualizar seeds.

### Fase 3: Calidad y mantenibilidad

1. Hacer pasar lint.
2. Tipar contratos frontend/backend.
3. Agregar CI con build, tests, lint y e2e.
4. Revisar CORS, variables de entorno y configuracion por ambiente.

## Estado de verificaciones

Durante la revision se ejecutaron estas verificaciones:

- `backend npm run build`: OK.
- `backend npm run test`: OK.
- `frontend npm run build`: OK.
- `backend npm run test:e2e`: OK.
- `backend lint`: falla.
- `frontend lint`: falla.
- `git status`: bloqueado por `dubious ownership / safe.directory`.
