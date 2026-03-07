#!/bin/bash

echo "🚀 Levantando base de datos (Docker)..."
cd backend || exit 1
docker compose up -d

echo "⏳ Esperando base de datos..."
sleep 5

echo "🧠 Iniciando backend..."
npm run start:dev &

echo "🌐 Iniciando frontend..."
cd ../frontend || exit 1
npm run dev