#!/bin/bash
# Fusiey Dev Server Startup Script
# Usage: bash dev.sh

export PATH="$PATH:/d/Software/Nodejs"

echo "[Fusiey] Stopping existing processes..."
npx kill-port 3000 2>/dev/null
npx kill-port 5173 2>/dev/null
sleep 1

echo "[Fusiey] Starting backend (port 3000)..."
nohup npx tsx server/src/app.ts > /tmp/fusiey-server.log 2>&1 &
sleep 2

echo "[Fusiey] Starting frontend (port 5173)..."
nohup npx vite --config client/vite.config.ts > /tmp/fusiey-vite.log 2>&1 &
sleep 2

echo ""
echo "==================================="
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000"
echo "==================================="
echo ""
echo "Logs:"
echo "  Server: /tmp/fusiey-server.log"
echo "  Vite:   /tmp/fusiey-vite.log"
