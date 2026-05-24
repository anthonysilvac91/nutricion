# Frontend Nutricion

Aplicacion Next.js para la interfaz de nutricionistas, pacientes, mediciones y administracion.

## Stack

- Next.js 16.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- `react-hook-form`.
- `zod`.
- `lucide-react`.
- `recharts`.

## Configuracion

Crear o revisar `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4100
```

El backend debe estar corriendo en `http://localhost:4100`.

## Ejecucion

```bash
npm install
npm run dev
```

Frontend:

- `http://localhost:3100`

## Build

```bash
npm run build
```

Estado verificado el 2026-05-23:

- Build: OK.
- Lint: pendiente por deuda tecnica.

## Rutas principales

- `/login`
- `/register`
- `/dashboard`
- `/patients`
- `/patients/[id]`
- `/patients/[id]/edit`
- `/admin/nutritionists`

## Notas tecnicas

- La autenticacion usa JWT almacenado en `localStorage`.
- `NEXT_PUBLIC_API_URL` define la API consumida por el frontend.
- La pantalla de administracion de nutricionistas consume la API real de admin.
- Crear, eliminar y resetear contrasena no estan disponibles hasta que existan endpoints backend para esas acciones.
