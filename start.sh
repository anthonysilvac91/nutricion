#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Levantando base de datos PostgreSQL..."
cd "$ROOT_DIR/backend"
docker compose up -d

echo "Esperando base de datos..."
sleep 5

echo ""
echo "Servicios del proyecto:"
echo "- Base de datos: localhost:5433"
echo "- Backend API:   http://localhost:4100"
echo "- Swagger:       http://localhost:4100/api"
echo "- Frontend:      http://localhost:3100"
echo ""
echo "Credenciales conocidas:"
echo "- Admin:         admin@nutriapp.com / admin123"
echo "- Nutricionista: nutri@demo.cl / 123456"
echo ""
echo "Nota: las credenciales existen si ya corriste los seeds correspondientes."
echo "      Catalogos: cd backend && npx ts-node prisma/seed-catalogs.ts"
echo "      Demo/admin: cd backend && npx prisma db seed"
echo ""

echo "Iniciando backend en segundo plano..."
npm run start:dev &
BACKEND_PID=$!

echo "Iniciando frontend..."
cd "$ROOT_DIR/frontend"
npm run dev

echo "Deteniendo backend..."
kill "$BACKEND_PID" 2>/dev/null || true
